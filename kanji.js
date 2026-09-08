/* ══════════════════════════════════════════════════
   kanji.js — Logique principale
   Charger APRÈS hanzi-writer.js dans index.html :
     <script src="hanzi-writer.js"></script>
     <script src="kanji.js"></script>
══════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════
   QUIZ OVERRIDES — Lectures prioritaires
   Consultés en premier par getBestReading() avant
   d'utiliser les données de kanji_jouyou_fr.json.
   Couvrent les kanji courants mal interprétés.
══════════════════════════════════════════════════ */
const quizOverrides = {
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
   QUIZ VOCAL — NORMALISATION DU RÉSULTAT MICRO
   Gère : chiffres arabes, kanji+okurigana, katakana
══════════════════════════════════════════════════ */

// Table inverse : chiffre arabe → hiragana
const arabicToHira = {
    '0':'ぜろ','1':'いち','2':'に','3':'さん','4':'よん','5':'ご',
    '6':'ろく','7':'なな','8':'はち','9':'きゅう','10':'じゅう',
    '11':'じゅういち','12':'じゅうに','20':'にじゅう',
    '100':'ひゃく','1000':'せん','10000':'まん'
};

// Katakana → hiragana
const toHira = s => s.replace(/[\u30a1-\u30f6]/g,
    c => String.fromCharCode(c.charCodeAt(0) - 0x60));

// Hiragana → Katakana (inverse de toHira) — pour l'affichage On'yomi
const toKata = s => s.replace(/[\u3041-\u3096]/g,
    c => String.fromCharCode(c.charCodeAt(0) + 0x60));

// Nettoie et normalise ce que le micro a capté
function normalizeOralResult(raw) {
    let s = raw.replace(/[。\.、，？！!\?\s「」『』]/g, '').trim();

    // 1. Chiffre arabe → hiragana (le moteur retourne "8" pour "はち")
    if (arabicToHira[s]) return arabicToHira[s];

    // 2. Katakana → hiragana
    s = toHira(s);

    // 3. Si le résultat contient encore des kanji, remplacer chaque kanji
    //    par sa lecture via quizOverrides (sans okurigana ni point)
    if (/[\u4e00-\u9fff]/.test(s)) {
        s = s.replace(/[\u4e00-\u9fff]/g, kanji => {
            const ov = quizOverrides[kanji];
            if (ov) return toHira(ov.replace(/[.\-][^\s]*$/, '')); // stem seulement
            return kanji; // garde le kanji si pas de mapping connu
        });
        s = toHira(s);
    }

    return s;
}

// Vérifie si le résultat brut du micro correspond à une lecture valide du kanji
function isResultCorrect(rawResult, kanjiChar, kanjiData) {
    const s = normalizeOralResult(rawResult);

    // --- Cas 1 : résultat = kanji cible seul ou kanji + okurigana ---
    // ex. "入る" quand on attendait "はいる"
    const kanjiRegex = new RegExp('^' + kanjiChar + '(.*)$');
    const kanjiMatch = rawResult.match(kanjiRegex);
    if (kanjiMatch) {
        const okuInResult = toHira(kanjiMatch[1]); // la partie kana après le kanji
        // Chercher un KUN reading dont l'okurigana correspond
        return (kanjiData.kun || []).some(kun => {
            const dotIdx = kun.indexOf('.');
            if (dotIdx === -1) {
                // Pas d'okurigana attendue : résultat doit être juste le kanji
                return okuInResult === '';
            }
            const expectedOku = toHira(kun.slice(dotIdx + 1).split('/')[0]);
            return okuInResult === '' || okuInResult === expectedOku;
        }) || (kanjiData.on || []).length > 0 && okuInResult === '';
    }

    // --- Cas 2 : comparaison sur toutes les lectures valides ---
    const allReadings = getAllValidReadings(kanjiData);
    return allReadings.some(r => {
        // Normalise la lecture attendue (retire okurigana, point, tiret)
        const clean = toHira(r.replace(/[.\-].*/, '').replace(/[/\s].*/, '').trim());
        return s === clean;
    });
}

/* ── QUIZ VOCAL ── */
function startOralTest(kanjiChar) {
    const kanjiData = kanjiDb.find(k => k.char === kanjiChar);
    if (!kanjiData) return;

    const bestRead = getBestReading(kanjiData);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const fb  = document.getElementById('voice-feedback');
    const btn = document.getElementById('btn-oral-test');

    if (!SpeechRecognition) {
        if (fb) { fb.style.color = '#e55'; fb.textContent = 'Micro non supporté sur ce navigateur'; }
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = false;
    recognition.maxAlternatives = 3; // plus d'alternatives pour augmenter les chances

    if (btn) btn.classList.add('listening');
    if (fb)  { fb.style.color = 'var(--gray)'; fb.textContent = '🎤 En écoute…'; }
    recognition.start();

    recognition.onresult = (event) => {
        if (btn) btn.classList.remove('listening');

        // Essayer toutes les alternatives retournées par le moteur
        const alternatives = Array.from({ length: event.results[0].length },
            (_, i) => event.results[0][i].transcript.trim());

        const isCorrect = alternatives.some(alt => isResultCorrect(alt, kanjiChar, kanjiData));
        const displayed = alternatives[0]; // pour l'affichage

        if (isCorrect) {
            if (fb) { fb.style.color = 'var(--accent)'; fb.textContent = `✔ Correct ! « ${displayed} »`; }
            localStorage.setItem('mastered_' + kanjiChar, 'true');
            trackItem(kanjiChar, 'mastered');
            refreshMasteryUI();
        } else {
            const hint = getAllValidReadings(kanjiData).slice(0,3)
                .map(r => toHira(r.replace(/[.\-].*/, ''))).join(', ');
            if (fb) { fb.style.color = '#e55'; fb.textContent = `✘ Dit : « ${displayed} » — Attendu : ${bestRead}  (${hint})`; }
        }
    };

    recognition.onerror = (e) => {
        if (btn) btn.classList.remove('listening');
        if (fb)  { fb.style.color = '#e55'; fb.textContent = 'Erreur micro : ' + e.error; }
    };

    recognition.onspeechend = () => recognition.stop();
}

/* ══════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════ */
let exemplesDb   = {};
let jlptMapping  = null;    // Mapping JLPT (chargé depuis data/mapping.json)
let exemplesByLevel = {};  // {n5: {...}, n4: {...}, ...} — exemples contextualisés
let kanjiDb  = [];
let kanjiMap = new Map();   // char → index dans kanjiDb  (O(1) lookup)
let categories = new Map(); // catId → {id, label, color, short, indices[]}
let seriesMap  = new Map(); // seriesId → {id, catId, label, indices[]}
let writer = null, currentChar = null, currentType = null;
let kanaAnimTimeouts = [], fetchCtrl = null;
let currentCatId = null;    // catégorie affichée
let currentJLPTLevel = null; // niveau JLPT actuel ('n5', 'n4', etc.)
let grammarHomeData = null;  // {levelId, data, examples} pour la page d'accueil grammar
let vocabHomeData = null;    // {levelId, data, examples} pour la page d'accueil vocab
let kanjiHomeData = null;    // {levelId, chars} pour la page d'accueil kanji
let currentLevelId = null;   // Pour accès rapide au level actuel
let kanjiReviewSession = null; // { queue: [char,...], index, results, flipped } — mode flashcard uniquement
let quizState = null;       // {indices, shuffled, idx, score, answered, title, sourceType, sourceId}
let searchOpen = false;

const SERIES_SIZE = 20;

/* ══════════════════════════════════════════════════
   TRACKING & PERSISTENCE (LocalStorage)
══════════════════════════════════════════════════ */
const STORAGE_KEY = 'kanji_trad_tracking';

function getTracking() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
}

function saveTracking(tracking) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tracking));
}

// Identifiant de suivi pour la fiche détail actuellement ouverte (kanji ou kana)
function getDetailTrackingId() {
    if (currentType === 'kana') return 'kana_' + currentChar;
    return currentChar; // kanji : le caractère lui-même sert d'id
}

// Met à jour le badge + le bouton de maîtrise de la fiche détail actuellement affichée
function refreshMasteryUI() {
    const itemId = getDetailTrackingId();
    const status = getItemStatus(itemId);
    const mastered = status === 'mastered';

    const badge = document.getElementById('d-mastery-badge');
    if (badge) {
        badge.textContent = mastered ? '✔ Maîtrisé' : 'Non maîtrisé';
        badge.classList.toggle('mastered', mastered);
    }
    const btn = document.getElementById('detail-master-btn');
    if (btn) {
        btn.textContent = mastered ? '✓ Maîtrisé' : '✓ Marquer comme maîtrisé';
        btn.classList.toggle('active', mastered);
    }
}

// Bascule la maîtrise de l'élément actuellement affiché dans la fiche détail (kanji ou kana)
function toggleDetailMastery() {
    const itemId = getDetailTrackingId();
    const isMastered = getItemStatus(itemId) === 'mastered';
    trackItem(itemId, isMastered ? 'null' : 'mastered');
    refreshMasteryUI();
}

function trackItem(itemId, status) {
    const tracking = getTracking();
    if (!tracking[itemId]) tracking[itemId] = {};
    
    if (status === null || status === 'null') {
        delete tracking[itemId];
    } else {
        tracking[itemId].status = status;
        tracking[itemId].lastUpdate = new Date().toISOString();
    }
    
    saveTracking(tracking);
    // Le cache de "Niveaux de maîtrise" (accueil) doit être invalidé à chaque changement de statut,
    // sinon il reste figé sur les valeurs calculées lors du tout premier chargement de la page.
    for (const key in levelStatsCache) delete levelStatsCache[key];
    return tracking[itemId];
}

function getItemStatus(itemId) {
    return getTracking()[itemId]?.status || null;
}

/* ══════════════════════════════════════════════════
   SÉLECTION EN MASSE — validation rapide de maîtrise
   ─────────────────────────────────────────────────
   Mode "tap pour basculer" : dans une des 4 listes (vocab, grammaire, kanji,
   kana), taper une fiche bascule IMMÉDIATEMENT son statut maîtrisé (retire
   la maîtrise si elle l'était déjà, l'ajoute sinon) — plus de sélection en
   attente à valider après coup. Le bouton "Valider" du bandeau du bas ne
   fait donc que fermer le mode (les écritures ont déjà eu lieu au fil des taps).
   Une case à cocher par catégorie (vocab/grammaire/kana) permet de basculer
   un groupe entier d'un coup, en plus du tap fiche par fiche.
   Les ids utilisés sont directement les ids trackItem (word.id, lesson.id,
   caractère kanji, ou 'kana_'+caractère).
══════════════════════════════════════════════════ */
let bulkSelectMode      = false;
let bulkSelectRerender  = null; // () => void — redessine l'écran courant dans son état actuel

// Conservée pour compatibilité de lecture visuelle : en pratique le badge ✔ (mastered-check)
// déjà présent sur chaque carte suffit à montrer l'état, donc cette fonction ne sert plus
// qu'à un éventuel style additionnel si besoin plus tard.
function isBulkSelected(id) {
    return false;
}

// À appeler dans le onclick de chaque carte, à la place de l'ouverture directe de la fiche
function handleListItemClick(el, id, openFn) {
    if (bulkSelectMode) {
        toggleItemMasteryLive(id);
        // Mise à jour directe de la carte tapée plutôt qu'un rafraîchissement complet de
        // l'écran (bulkSelectRerender) : celui-ci reconstruit tout le HTML et referme donc
        // les catégories/unités actuellement dépliées — gênant si on valide plusieurs fiches
        // d'affilée dans la même catégorie.
        updateMasteryBadgeInPlace(el, id);
    } else {
        openFn();
    }
}

// Ajoute ou retire le badge ✔ sur la carte tapée, sans reconstruire tout l'écran
function updateMasteryBadgeInPlace(el, id) {
    if (!el) return;
    const isMastered = getItemStatus(id) === 'mastered';
    let badge = el.querySelector('.mastered-check');
    if (isMastered) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'mastered-check';
            badge.textContent = '✔';
            el.prepend(badge);
        }
    } else if (badge) {
        badge.remove();
    }
}

// Bascule immédiate de la maîtrise d'un seul item
function toggleItemMasteryLive(id) {
    const isMastered = getItemStatus(id) === 'mastered';
    trackItem(id, isMastered ? 'null' : 'mastered');
}

// Bascule un groupe entier via sa case à cocher : si elle vient d'être cochée, tout le groupe
// est marqué maîtrisé ; si elle vient d'être décochée, tout le groupe perd sa maîtrise.
function toggleCategoryMasteryLive(checkboxEl, ids) {
    const status = checkboxEl.checked ? 'mastered' : 'null';
    ids.forEach(id => trackItem(id, status));
    if (bulkSelectRerender) bulkSelectRerender();
}

function enterBulkSelectMode(rerenderFn) {
    bulkSelectMode     = true;
    bulkSelectRerender = rerenderFn;
    rerenderFn();
    updateBulkActionBar();
}

function exitBulkSelectMode() {
    bulkSelectMode     = false;
    const fn = bulkSelectRerender;
    bulkSelectRerender = null;
    if (fn) fn();
    updateBulkActionBar();
}

function updateBulkActionBar() {
    const bar = document.getElementById('bulk-action-bar');
    if (!bar) return;
    bar.style.display = bulkSelectMode ? 'flex' : 'none';
}

/* ══════════════════════════════════════════════════
   SRS (Spaced Repetition System) — SM-2 allégé
   Stocké dans le même objet que le tracking (clé "srs" par item),
   donc aucune migration nécessaire : les entrées sans srs sont
   simplement traitées comme "nouvelles".
══════════════════════════════════════════════════ */
const SRS_NEW_PER_SESSION = 10; // nombre max de nouvelles cartes introduites par session de révision

function getSrsInfo(itemId) {
    return getTracking()[itemId]?.srs || null;
}

function saveSrsInfo(itemId, srsData) {
    const tracking = getTracking();
    if (!tracking[itemId]) tracking[itemId] = {};
    tracking[itemId].srs = srsData;
    saveTracking(tracking);
}

// quality : 0 = Encore (échec), 1 = Difficile, 2 = Bien, 3 = Facile
// quality : 0 = Encore (échec), 1 = Difficile, 2 = Bien, 3 = Facile
// meta (optionnel) : { type, label } — utilisé uniquement pour le widget "À renforcer"
// (point #10), n'affecte jamais le calcul SRS lui-même. Rétrocompatible : un appel sans
// meta fonctionne exactement comme avant.
function gradeReview(itemId, quality, meta = null) {
    const now = new Date();
    const existing = getSrsInfo(itemId) || { interval: 0, easeFactor: 2.5, repetitions: 0 };
    let { interval, easeFactor, repetitions } = existing;
    
    if (quality === 0) {
        // Échec : on repart de zéro, ease pénalisée, révision dès demain
        repetitions = 0;
        interval = 1;
        easeFactor = Math.max(1.3, easeFactor - 0.2);
    } else {
        repetitions += 1;
        if (quality === 1) { // Difficile
            interval = repetitions === 1 ? 1 : Math.round(interval * 1.2);
            easeFactor = Math.max(1.3, easeFactor - 0.15);
        } else if (quality === 2) { // Bien
            interval = repetitions === 1 ? 1 : (repetitions === 2 ? 3 : Math.round(interval * easeFactor));
        } else { // Facile
            interval = repetitions === 1 ? 2 : (repetitions === 2 ? 4 : Math.round(interval * easeFactor * 1.3));
            easeFactor += 0.15;
        }
    }
    
    const nextReviewDate = new Date(now);
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);
    
    const srsData = {
        interval, easeFactor, repetitions,
        lastReviewDate: now.toISOString(),
        nextReviewDate: nextReviewDate.toISOString()
    };
    saveSrsInfo(itemId, srsData);
    recordReviewEvent(quality);
    updateWeaknessTracking(itemId, quality, meta);
    return srsData;
}

/* ══════════════════════════════════════════════════
   FAIBLESSES — indépendant du SRS (point #10, widget "À renforcer")
   ─────────────────────────────────────────────────
   Répond à une question différente du SRS : pas "quand revoir cette carte ?"
   mais "qu'est-ce qui pose problème EN CE MOMENT ?". Une carte peut être
   parfaitement planifiée dans 15 jours par le SRS tout en ayant été ratée
   plusieurs fois récemment — les deux systèmes coexistent sans se mélanger.
   V1 volontairement simple : compteur d'échecs consécutifs, remis à zéro
   (l'item disparaît du widget) dès la première réussite suivante.
══════════════════════════════════════════════════ */
const WEAKNESS_KEY = 'kanji_trad_weakness';

function getWeaknessData() {
    const stored = localStorage.getItem(WEAKNESS_KEY);
    return stored ? JSON.parse(stored) : {};
}
function saveWeaknessData(d) { localStorage.setItem(WEAKNESS_KEY, JSON.stringify(d)); }

// Point #6 V2 — Relearning intra-session : une carte ratée ("Encore") réapparaît quelques
// questions plus tard dans LA MÊME session, en plus (pas à la place) de sa reprogrammation SRS
// normale via gradeReview(). N'affecte que l'affichage de la session — si la carte revient et
// est notée à nouveau, gradeReview() est rappelée normalement, comme pour n'importe quelle
// notation (pas de cas spécial : le second passage est un vrai second essai, pas une simple relecture).
function scheduleRelearning(session, entry) {
    if (!session || !session.queue) return;
    const gap = 3 + Math.floor(Math.random() * 4); // réapparaît 3 à 6 questions plus tard
    const insertAt = Math.min(session.index + 1 + gap, session.queue.length);
    session.queue.splice(insertAt, 0, entry);
}

function updateWeaknessTracking(itemId, quality, meta) {
    const data = getWeaknessData();
    if (quality === 0) {
        const existing = data[itemId] || { consecutiveFails: 0, totalFails: 0 };
        data[itemId] = {
            consecutiveFails: existing.consecutiveFails + 1,
            totalFails: (existing.totalFails || 0) + 1,
            lastFailDate: new Date().toISOString(),
            type: (meta && meta.type) || existing.type || 'vocab',
            label: (meta && meta.label) || existing.label || itemId
        };
    } else if (data[itemId]) {
        // Première réussite après un échec : on considère la notion consolidée, elle sort du widget.
        delete data[itemId];
    }
    saveWeaknessData(data);
}

// Score de priorité pondéré (point #3 V2) — remplace le tri simple "juste consecutiveFails"
// du V1. Trois signaux combinés :
//  - consecutiveFails (poids fort) : la répétition immédiate de l'échec est le signal le plus fiable
//  - totalFails (poids faible) : un problème chronique compte un peu, même s'il n'est pas récent
//  - récence (décroissance linéaire sur 14 jours) : un échec d'hier doit primer sur un échec
//    d'il y a 3 semaines à consecutiveFails égal — sans ça, une vieille faiblesse jamais retravaillée
//    resterait accrochée en haut du widget indéfiniment.
function computeWeaknessPriority(rec) {
    const daysSince = (Date.now() - new Date(rec.lastFailDate).getTime()) / 86400000;
    const recencyFactor = Math.max(0, 1 - daysSince / 14);
    return (rec.consecutiveFails || 0) * 5 + (rec.totalFails || 0) * 1 + recencyFactor * 8;
}

/* ══════════════════════════════════════════════════
   STATS PERSISTANTES (réussite globale, sessions, cartes du mois)
   Alimentées automatiquement à chaque gradeReview(), peu importe le type (vocab/grammaire/kanji/mixte)
══════════════════════════════════════════════════ */
const STATS_KEY = 'kanji_trad_stats';

function getStats() {
    const stored = localStorage.getItem(STATS_KEY);
    return stored ? JSON.parse(stored) : { totalReviews: 0, successCount: 0, sessionsCount: 0, monthKey: null, monthCount: 0 };
}

function saveStats(s) {
    localStorage.setItem(STATS_KEY, JSON.stringify(s));
}

function recordReviewEvent(quality) {
    const s = getStats();
    s.totalReviews++;
    if (quality >= 2) s.successCount++; // Bien ou Facile = réussite
    
    const currentMonthKey = new Date().toISOString().slice(0, 7);
    if (s.monthKey !== currentMonthKey) { s.monthKey = currentMonthKey; s.monthCount = 0; }
    s.monthCount++;
    
    saveStats(s);
}

function recordSessionCompleted() {
    const s = getStats();
    s.sessionsCount++;
    saveStats(s);
}

// Construit la file de révision : cartes dues en priorité, puis un quota de nouvelles cartes
function buildDueQueue(items) {
    const now = new Date();
    const due = [];
    const fresh = [];
    
    items.forEach(item => {
        const srs = getSrsInfo(item.id);
        if (!srs) {
            fresh.push(item);
        } else if (new Date(srs.nextReviewDate) <= now) {
            due.push(item);
        }
    });
    
    return [...due, ...fresh.slice(0, SRS_NEW_PER_SESSION)];
}

function countDueItems(items) {
    return buildDueQueue(items).length;
}

// Comme buildDueQueue, mais retourne le détail due/nouveaux séparément (pour l'affichage à la Hibi)
function splitDueAndNew(items) {
    const now = new Date();
    let due = 0, fresh = 0;
    items.forEach(item => {
        const srs = getSrsInfo(item.id);
        if (!srs) fresh++;
        else if (new Date(srs.nextReviewDate) <= now) due++;
    });
    return { due, fresh: Math.min(fresh, SRS_NEW_PER_SESSION) };
}

/* ══════════════════════════════════════════════════
   buildReviewQueue() — constructeur de file CENTRALISÉ
   ─────────────────────────────────────────────────
   Contrairement à buildDueQueue() (limite "10 nouvelles" appliquée
   PAR combinaison type×niveau, utilisée par la révision ciblée de
   l'onglet "Réviser" — comportement volontairement inchangé), cette
   fonction applique un quota de nouvelles cartes GLOBAL sur toute la
   session, réparti en tour de rôle entre les combinaisons sélectionnées.
   Utilisée pour les sessions qui mélangent plusieurs types/niveaux
   (bouton "Aujourd'hui" de l'accueil, onglet "Apprendre").

   Ne modifie ni ne remplace buildDueQueue() : les deux coexistent,
   chacune pour son cas d'usage.
══════════════════════════════════════════════════ */

// Sépare due/fresh SANS plafonner les nouvelles (le plafonnement se fait
// globalement plus loin, contrairement à buildDueQueue qui plafonne ici même)
function splitDueAndFreshRaw(items) {
    const now = new Date();
    const due = [];
    const fresh = [];
    items.forEach(item => {
        const srs = getSrsInfo(item.id);
        if (!srs) fresh.push(item);
        else if (new Date(srs.nextReviewDate) <= now) due.push(item);
    });
    return { due, fresh };
}

// Récupère les items bruts (forme attendue par buildDueQueue : au moins un champ .id)
// pour un type de contenu et un niveau JLPT donnés. Kana volontairement absent pour
// l'instant (roadmap : intégration séparée), mais la fonction est prête à l'accueillir.
async function getRawItemsForTypeLevel(type, level) {
    if (type === 'vocab') {
        const vd = await getLevelVocabData(level);
        return (vd && vd.data) ? vd.data : [];
    }
    if (type === 'grammar') {
        const gd = await getLevelGrammarData(level);
        return (gd && gd.data) ? gd.data : [];
    }
    if (type === 'kanji') {
        const chars = await getLevelKanjiChars(level);
        return chars ? chars.map(c => ({ id: c })) : [];
    }
    return [];
}

// Répartit un quota de nouvelles cartes en tour de rôle entre plusieurs pools
// (buckets = [{ key, pool: [...] }]) — pure, sans effet de bord, testée isolément.
function distributeNewQuota(buckets, quota) {
    const picked = [];
    const pools = buckets.map(b => ({ key: b.key, pool: [...b.pool] }));
    let remaining = quota;
    while (remaining > 0 && pools.some(p => p.pool.length)) {
        for (const p of pools) {
            if (remaining <= 0) break;
            if (p.pool.length) {
                picked.push({ key: p.key, item: p.pool.shift() });
                remaining--;
            }
        }
    }
    return picked;
}

// Reconstruit la forme d'entrée de file attendue par les écrans de révision
// mixte existants ({ type, item }) — le kanji est normalisé en { char } comme
// le fait déjà getMixedDueQueue(). isNew distingue une carte due (déjà vue,
// planning SRS) d'une carte neuve (jamais vue, prélevée sur le quota global).
function makeQueueEntry(type, level, rawItem, isNew) {
    if (type === 'kanji') return { type, level, item: { char: rawItem.id }, isNew };
    return { type, level, item: rawItem, isNew };
}

/**
 * buildReviewQueue({ types, levels, includeDue, newLimit, excludeMastered, includeKana, kanaScripts })
 * - types   : sous-ensemble de ['vocab','grammar','kanji']
 * - levels  : sous-ensemble de ['n5','n4','n3','n2','n1']
 * - includeDue : si false, ignore les cartes dues (par défaut true — elles ne sont
 *   jamais plafonnées, quel que soit newLimit)
 * - newLimit : nombre MAXIMUM de nouvelles cartes pour TOUTE la session (pas par
 *   combinaison type×niveau), réparties en tour de rôle — le kana y participe comme
 *   une combinaison de plus (pas de quota séparé)
 * - excludeMastered : si true, retire les items marqués "mastered" (trackItem) du
 *   pool des NOUVELLES cartes uniquement — jamais des cartes dues. Le SRS reste seul
 *   juge de ce qui est "dû" : un item maîtrisé à la main (ex: validation en masse,
 *   qui ne passe jamais par gradeReview) n'a pas de planning SRS et tomberait sinon
 *   dans le pool "nouveau" — c'est ce cas précis qu'on exclut. Mais si un item a déjà
 *   un planning SRS et que son intervalle est expiré, il reste "dû" et s'affiche quand
 *   même, même marqué maîtrisé — le SRS a le dernier mot sur ce qui doit être revu.
 * - includeKana : si true, ajoute le kana à la file (par défaut false — comportement
 *   inchangé pour tous les appelants existants, ex: onglet "Apprendre")
 * - kanaScripts : sous-ensemble de ['hira','kata'], ignoré si includeKana=false
 * Retourne un tableau mélangé de { type, level, item }.
 */
async function buildReviewQueue({
    types = ['vocab', 'grammar', 'kanji'],
    levels = ['n5', 'n4', 'n3', 'n2', 'n1'],
    includeDue = true,
    newLimit = SRS_NEW_PER_SESSION,
    excludeMastered = false,
    includeKana = false,
    kanaScripts = ['hira', 'kata']
} = {}) {
    const buckets = [];

    for (const level of levels) {
        for (const type of types) {
            const items = await getRawItemsForTypeLevel(type, level);
            if (!items.length) continue;
            let { due, fresh } = splitDueAndFreshRaw(items);
            if (excludeMastered) {
                fresh = fresh.filter(it => getItemStatus(it.id) !== 'mastered');
            }
            if (due.length || fresh.length) buckets.push({ type, level, due, fresh });
        }
    }

    // Kana : axe "script" (hiragana/katakana) plutôt que niveau JLPT, donc traité à part
    // du double-boucle ci-dessus. getKanaFlatList() retourne déjà des items {id, char, romaji}
    // avec id au format 'kana_'+caractère — directement compatible avec trackItem/gradeReview.
    if (includeKana) {
        for (const script of kanaScripts) {
            const items = getKanaFlatList(script);
            if (!items.length) continue;
            let { due, fresh } = splitDueAndFreshRaw(items);
            if (excludeMastered) {
                fresh = fresh.filter(it => getItemStatus(it.id) !== 'mastered');
            }
            if (due.length || fresh.length) buckets.push({ type: 'kana', level: script, due, fresh });
        }
    }

    const queue = [];

    // Cartes dues : toutes incluses, jamais plafonnées (ni filtrées par mastered)
    if (includeDue) {
        buckets.forEach(b => b.due.forEach(rawItem => queue.push(makeQueueEntry(b.type, b.level, rawItem, false))));
    }

    // Nouvelles cartes : quota global réparti en tour de rôle entre les combinaisons concernées
    const freshBuckets = buckets.filter(b => b.fresh.length).map(b => ({ key: `${b.type}_${b.level}`, pool: b.fresh }));
    const freshBucketMeta = {};
    buckets.forEach(b => { freshBucketMeta[`${b.type}_${b.level}`] = { type: b.type, level: b.level }; });

    distributeNewQuota(freshBuckets, newLimit).forEach(({ key, item }) => {
        const meta = freshBucketMeta[key];
        queue.push(makeQueueEntry(meta.type, meta.level, item, true));
    });

    return prioritizeQueue(queue);
}

// Nombre de jours de retard d'un item par rapport à son échéance SRS (0 si pas encore dû ou pas
// de planning du tout — les nouvelles cartes n'ont pas de "retard").
function getDaysOverdue(itemId) {
    const srs = getSrsInfo(itemId);
    if (!srs) return 0;
    return (Date.now() - new Date(srs.nextReviewDate).getTime()) / 86400000;
}

const URGENT_OVERDUE_DAYS = 2;

// Palier de priorité d'une entrée { type, level, item, isNew } :
//   0 = due urgente   (en retard de 2 jours ou plus — le plus grand risque d'oubli)
//   1 = due normale    (due mais pas encore très en retard)
//   2 = nouvelle "difficile" (jamais vue, mais déjà présente dans le tracker de faiblesse —
//       ex: item marqué maîtrisé en masse puis re-raté plus tard, ou reset manuel)
//   3 = nouvelle normale
function computeQueuePriorityTier(entry) {
    const id = getEntryTrackingId(entry);
    if (!entry.isNew) {
        return getDaysOverdue(id) >= URGENT_OVERDUE_DAYS ? 0 : 1;
    }
    return getWeaknessData()[id] ? 2 : 3;
}

// Priorisation de la file (point #5 V2) : dues urgentes > dues normales > nouvelles difficiles >
// nouvelles normales. Le mélange aléatoire reste appliqué, mais uniquement À L'INTÉRIEUR de
// chaque palier — pas de monotonie (jamais "tout le vocab avant tout le kanji" par exemple),
// tout en respectant la priorité globale entre paliers.
function prioritizeQueue(queue) {
    const tiers = [[], [], [], []];
    queue.forEach(entry => tiers[computeQueuePriorityTier(entry)].push(entry));
    return tiers.flatMap(tier => shuffleArray(tier));
}

// Score approximatif 0-100 dérivé du SRS (répétitions + facilité), pour affichage visuel uniquement.
// Ce n'est PAS un vrai score de rétention scientifique, juste une approximation cohérente.
function getSrsConfidencePct(itemId) {
    const srs = getSrsInfo(itemId);
    if (!srs) return null; // jamais révisé
    const repScore = Math.min(srs.repetitions * 15, 70);
    const easeScore = Math.min(Math.max((srs.easeFactor - 1.3) / (2.5 - 1.3), 0), 1) * 30;
    return Math.min(100, Math.round(repScore + easeScore));
}

/* ══════════════════════════════════════════════════
   STREAK (série de jours consécutifs)
══════════════════════════════════════════════════ */
const STREAK_KEY = 'kanji_trad_streak';

function getStreakData() {
    const stored = localStorage.getItem(STREAK_KEY);
    return stored ? JSON.parse(stored) : { currentStreak: 0, bestStreak: 0, lastActiveDate: null, activityDates: [] };
}

function saveStreakData(data) {
    localStorage.setItem(STREAK_KEY, JSON.stringify(data));
}

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

function daysBetween(dateStrA, dateStrB) {
    const a = new Date(dateStrA + 'T00:00:00');
    const b = new Date(dateStrB + 'T00:00:00');
    return Math.round((b - a) / 86400000);
}

// À appeler une fois par ouverture d'app : enregistre le jour comme actif et met à jour la série
function recordDailyActivity() {
    const streak = getStreakData();
    const today = todayStr();
    
    if (streak.lastActiveDate === today) return streak; // déjà comptabilisé aujourd'hui
    
    if (streak.lastActiveDate) {
        const gap = daysBetween(streak.lastActiveDate, today);
        if (gap === 1) streak.currentStreak += 1;
        else if (gap > 1) streak.currentStreak = 1;
    } else {
        streak.currentStreak = 1;
    }
    
    streak.bestStreak = Math.max(streak.bestStreak, streak.currentStreak);
    streak.lastActiveDate = today;
    
    if (!streak.activityDates.includes(today)) {
        streak.activityDates.push(today);
        streak.activityDates = streak.activityDates.filter(d => daysBetween(d, today) <= 90);
    }
    
    saveStreakData(streak);
    return streak;
}

function buildMonthCalendar(streak) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let startOffset = firstDay.getDay() - 1; // 0=lundi...6=dimanche
    if (startOffset < 0) startOffset = 6;
    
    const dayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    const headerHtml = dayLabels.map(d => `<div class="cal-day-label">${d}</div>`).join('');
    
    let cellsHtml = '';
    for (let i = 0; i < startOffset; i++) {
        cellsHtml += `<div class="cal-cell empty"></div>`;
    }
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isActive = streak.activityDates.includes(dateStr);
        const isToday = dateStr === todayStr();
        const cls = `cal-cell${isActive ? ' active' : ''}${isToday ? ' today' : ''}`;
        cellsHtml += `<div class="${cls}">${isActive ? '❀' : day}</div>`;
    }
    
    return `<div class="cal-grid">${headerHtml}${cellsHtml}</div>`;
}

async function showProgressionDetail(isBack = false) {
    if (!isBack) history.pushState({ view: 'progression' }, '');
    const streak = getStreakData();
    const stats = getStats();
    
    // Stats vocab agrégées sur tous les niveaux ayant des données
    const levels = ['n5', 'n4', 'n3', 'n2', 'n1'];
    let vocabTotal = 0, vocabMastered = 0;
    for (const lvl of levels) {
        const vg = await getLevelVocabGrammarStats(lvl);
        vocabTotal += vg.vocabTotal;
        vocabMastered += vg.vocabMastered;
    }
    
    const successPct = stats.totalReviews > 0 ? Math.round((stats.successCount / stats.totalReviews) * 100) : 0;
    const currentMonthKey = new Date().toISOString().slice(0, 7);
    const monthCount = stats.monthKey === currentMonthKey ? stats.monthCount : 0;
    
    document.getElementById('main-content').innerHTML = `
        <div class="progression-page">
            <button class="back-btn" onclick="navDashboard()">←</button>
            <div class="progression-title">Ta progression</div>
            <div class="progression-subtitle">${stats.sessionsCount} session${stats.sessionsCount > 1 ? 's' : ''} · ${streak.currentStreak} jour${streak.currentStreak > 1 ? 's' : ''} d'affilée</div>
            
            <div class="streak-detail-card">
                <div class="streak-detail-label">SÉRIE ACTUELLE</div>
                <div class="streak-detail-row">
                    <div class="streak-detail-num">${streak.currentStreak}<span class="streak-detail-unit">jours</span></div>
                    <div class="streak-detail-record">Record : ${streak.bestStreak} jours</div>
                </div>
                ${buildMonthCalendar(streak)}
            </div>
            
            <div class="progression-stats-grid">
                <div class="progression-stat-card">
                    <div class="progression-stat-icon">📚</div>
                    <div class="progression-stat-num">${vocabMastered}<span class="progression-stat-total">/${vocabTotal}</span></div>
                    <div class="progression-stat-label">Mots maîtrisés</div>
                </div>
                <div class="progression-stat-card">
                    <div class="progression-stat-icon">％</div>
                    <div class="progression-stat-num">${successPct}<span class="progression-stat-total">%</span></div>
                    <div class="progression-stat-label">Réussite</div>
                </div>
                <div class="progression-stat-card">
                    <div class="progression-stat-icon">🗂️</div>
                    <div class="progression-stat-num">${stats.sessionsCount}</div>
                    <div class="progression-stat-label">Sessions</div>
                </div>
                <div class="progression-stat-card">
                    <div class="progression-stat-icon">📅</div>
                    <div class="progression-stat-num">${monthCount}</div>
                    <div class="progression-stat-label">Cartes · ce mois</div>
                </div>
            </div>
        </div>`;
}

function buildStreakDotsHtml(streak) {
    const today = new Date();
    let html = '';
    for (let i = 27; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().slice(0, 10);
        const active = streak.activityDates.includes(dStr);
        html += `<div class="dot${active ? ' active' : ''}"></div>`;
    }
    return html;
}

/* ══════════════════════════════════════════════════
   WEB SPEECH API - Prononciation
══════════════════════════════════════════════════ */
function speakText(text, lang = 'ja-JP') {
    if (typeof SpeechSynthesisUtterance !== 'undefined') {
        const synth = window.speechSynthesis;
        if (synth.speaking) synth.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.8;
        utterance.pitch = 1;
        synth.speak(utterance);
    }
}

/* ══════════════════════════════════════════════════
   MAPPING CATÉGORIES : Anglais → Français
══════════════════════════════════════════════════ */
const VOCAB_CATEGORY_MAP = {
    'action': '🎬 Action',
    'color': '🎨 Couleurs',
    'descriptor': '✨ Descripteurs',
    'nature': '🌿 Nature',
    'time': '⏰ Temps',
    'food': '🍜 Nourriture',
    'body': '🏃 Corps',
    'weather': '⛅ Météo',
    'direction': '🧭 Directions',
    'people': '👥 Personnes',
    'family': '👨‍👩‍👧‍👦 Famille',
    'place': '🏠 Lieux',
    'object': '📦 Objets',
    'state': '💫 État',
    'communication': '💬 Communication',
    'movement': '🚶 Mouvement',
    'question': '❓ Questions',
    'interrogative': '❓ Interrogatifs',
    'number': '🔢 Nombres',
    'animal': '🐶 Animaux',
    'abstract': '🧠 Concepts',
    'art': '🎭 Arts',
    'language': '🗣️ Langues',
    'clothing': '👕 Vêtements',
    'phrase': '💭 Expressions',
    'grammar': '📚 Grammaire'
};

const GRAMMAR_TYPE_MAP = {
    'copula': 'Copule (être)',
    'verb-form': 'Formes verbales',
    'particle': 'Particules',
    'adjective': 'Adjectifs',
    'verb-phrase': 'Expressions verbales',
    'suffix': 'Suffixes',
    'expression': 'Expressions',
    'comparison': 'Comparaisons',
    'quotation': 'Citations',
    'opinion': 'Opinions',
    'conjunction': 'Conjonctions',
    'time-clause': 'Clauses temporelles'
};

/* ══════════════════════════════════════════════════
   DÉFINITIONS DE CATÉGORIES
══════════════════════════════════════════════════ */
const CAT_DEFS = [
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

/* ══════════════════════════════════════════════════
   CONSTRUCTION DES STRUCTURES DE DONNÉES
══════════════════════════════════════════════════ */
function buildCategories() {
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

    categories.clear();
    CAT_DEFS.forEach(def => {
        let indices;
        const num = def.id[1];
        if      (def.id.startsWith('p')) indices = pBuckets[num] || [];
        else if (def.id === 'c1')        indices = collegeParts[0];
        else if (def.id === 'c2')        indices = collegeParts[1];
        else if (def.id === 'c3')        indices = collegeParts[2];
        else                             indices = hyoIdx;
        categories.set(def.id, { ...def, indices });
    });
}

function buildSeries() {
    seriesMap.clear();
    const MIN = 10, MAX = 20;
    for (const [catId, cat] of categories) {
        const { indices } = cat;
        if (!indices.length) continue;

        // Découpage en chunks de MAX
        const chunks = [];
        for (let i = 0; i < indices.length; i += MAX) {
            chunks.push(indices.slice(i, i + MAX));
        }

        // Fusion de la dernière chunk si elle est < MIN
        if (chunks.length >= 2 && chunks[chunks.length - 1].length < MIN) {
            const last = chunks.pop();
            chunks[chunks.length - 1] = chunks[chunks.length - 1].concat(last);
        }

        // Enregistrement avec plages de kanji (début–fin, 1-indexé)
        let offset = 0;
        chunks.forEach((chunk, i) => {
            const start = offset + 1;
            const end   = offset + chunk.length;
            const sid   = `${catId}_s${i + 1}`;
            seriesMap.set(sid, {
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
// Résoudre des indices → objets kanji (lecture seule, pas de copie)
function resolveKanjis(indices) {
    return indices.map(i => kanjiDb[i]);
}

/* ══════════════════════════════════════════════════
   LOGIQUE "MEILLEUR MATCH" — Règle d'or des lectures
   ─────────────────────────────────────────────────
   Algorithme :
   1. Extraire les racines WK (kun d'abord, puis on).
      Les entrées préfixées par "!" sont prioritaires.
   2. Pour chaque racine WK (ex: "た" depuis "!た") :
      chercher dans k.kun une entrée qui COMMENCE par
      cette racine (ex: "た.べる") → nettoyer → "たべる"
   3. Si aucun match kun, tenter avec on + wk_on.
   4. Fallback : first kun nettoyé, puis first on.
══════════════════════════════════════════════════ */
function kanjiDataLoader(char, onLoad, onError) {
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

/**
 * Loader HanziWriter dédié aux kana (hiragana/katakana).
 * Source principale : fork krmanik/hanzi-writer-data-jp (inclut les données kana,
 * fusionnées depuis ailectra/kana-json — le repo d'origine chanind/hanzi-writer-data-jp
 * ne couvre que les kanji). Repli direct sur ailectra/kana-json si le fork est indisponible.
 */
function kanaDataLoader(char, onLoad, onError) {
    const primary  = `https://raw.githubusercontent.com/krmanik/hanzi-writer-data-jp/master/data/${char}.json`;
    const fallback = `https://cdn.jsdelivr.net/gh/ailectra/kana-json@v0.0.1/data/${char}.json`;
    fetch(primary)
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(onLoad)
        .catch(() =>
            fetch(fallback)
                .then(r => r.ok ? r.json() : Promise.reject())
                .then(onLoad)
                .catch(() => { if (typeof onError === 'function') onError(); })
        );
}

function getBestReading(k) {
    // --- NOUVEAU : Priorité absolue aux exceptions manuelles ---
    if (typeof quizOverrides !== 'undefined' && quizOverrides[k.char]) {
        return quizOverrides[k.char];
    }

    // Nettoyage d'une lecture brute : retire point et tiret et ce qui suit
    const clean = r => r.replace(/[.·＊*].*/, '').replace(/-.*/, '').replace(/^!/, '').trim();

    // Extraire les racines WK, priorité aux "!" en tête de liste
    const wkRoots = (arr) => {
        const priority = arr.filter(r => r.startsWith('!')).map(r => clean(r));
        const normal   = arr.filter(r => !r.startsWith('!')).map(r => clean(r));
        return [...priority, ...normal].filter(Boolean);
    };

    // Rechercher dans un tableau de lectures la première qui commence par la racine
    const findMatch = (readings, root) =>
        readings.find(r => clean(r).startsWith(root));

    // --- Étape 1 : WK KUN → KUN dict ---
    for (const root of wkRoots(k.wk_kun || [])) {
        const match = findMatch(k.kun, root);
        if (match) return clean(match);
    }

    // --- Étape 2 : WK ON → ON dict ---
    for (const root of wkRoots(k.wk_on || [])) {
        const match = findMatch(k.on, root);
        if (match) return clean(match);
    }

    // --- Étape 3 : WK racine directe (si déjà complète) ---
    const allWk = [...wkRoots(k.wk_kun || []), ...wkRoots(k.wk_on || [])];
    if (allWk.length > 0) return allWk[0];

    // --- Étape 4 : Fallback dictionnaire ---
    if (k.kun && k.kun.length) return clean(k.kun[0]);
    if (k.on && k.on.length)   return clean(k.on[0]);
    return '?';
}

// Toutes les lectures valides pour comparaison vocale (nettoyées + romaji)
function getAllValidReadings(k) {
    const clean = r => r.replace(/[.·＊*].*/, '').replace(/-.*/, '').replace(/^!/, '').trim();
    const set = new Set();
    // Meilleure lecture en tête
    set.add(getBestReading(k));
    // Toutes les lectures kun et on nettoyées
    k.kun.forEach(r => { const c = clean(r); if (c) set.add(c); });
    k.on.forEach(r  => { const c = clean(r); if (c) set.add(c); });
    // Versions romaji
    [...set].forEach(r => { const ro = kanaToRomaji(r); if (ro !== r) set.add(ro); });
    return [...set].filter(Boolean);
}

/* ── HELPER : génère les chips ON/KUN pour l'affichage quiz ──────────────
   Retourne du HTML avec toutes les lectures ON (fond vert) et KUN (fond bleu).
   clean : retire point/tiret/okurigana et déduplication.
   maxOn / maxKun : limite d'affichage pour ne pas saturer l'interface.
   showBadge : affiche le label ON / KUN sur chaque chip.
───────────────────────────────────────────────────────────────────────── */
function buildReadingChips(k, { maxOn = 4, maxKun = 4, showBadge = true, chipStyle = '' } = {}) {
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
        // Fallback : afficher getBestReading si aucune lecture connue
        const best = getBestReading(k);
        return `<span class="quiz-reading-chip on-chip" ${chipStyle ? `style="${chipStyle}"` : ''}>
            <span class="chip-text">${best}</span>
        </span>`;
    }
    return onChips + kunChips;
}

// Label de réponse quiz : "Sens • meilleure lecture" (tronqué si besoin)
function choiceLabel(k) {
    const sens = k.meanings.filter(m => !m.toLowerCase().includes('radical'))[0] || k.meanings[0] || '?';
    const read = getBestReading(k);
    const full = read && read !== '?' ? `${sens} • ${read}` : sens;
    return full.length > 26 ? full.slice(0, 24) + '…' : full;
}

// Tirage aléatoire efficace de N leurres :
// Priorité au pool fourni (même série/catégorie), puis kanjiDb global en fallback
function pickDecoyIndices(excludeIdx, correctMeaning, count, preferredPool) {
    const result = [], tried = new Set([excludeIdx]);

    // Essayer d'abord dans le pool préféré (même catégorie/série)
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

    // Compléter depuis kanjiDb global si besoin
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

// Fisher-Yates sur un tableau d'indices (in-place, retourne le même tableau)
function shuffleIndices(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/* ══════════════════════════════════════════════════
   RECHERCHE
══════════════════════════════════════════════════ */
// searchOpen already declared above
let searchJustOpened = false;

function toggleSearch() {
    if (searchOpen) {
        // Déjà ouvert : on passe par history.back() pour garder l'historique cohérent
        // (fermeture réellement effectuée par MODAL_EXIT_REGISTRY['search'] au popstate)
        history.back();
        return;
    }
    searchOpen = true;
    resetSearchFilters();
    // Empêche le clic qui VIENT D'OUVRIR la recherche d'être aussi interprété
    // comme un "clic à l'extérieur" par le listener global (même événement, même bulle)
    searchJustOpened = true;
    setTimeout(() => { searchJustOpened = false; }, 0);
    pushModalState('search');
    document.getElementById('search-bar').classList.add('open');
    const main = document.getElementById('main-content');
    if (main) main.classList.add('search-open');
    setTimeout(() => document.getElementById('search-input').focus(), 220);
    showSearchPanel();
}

// Ferme réellement l'écran de recherche (appelée uniquement par le registre de retour,
// jamais directement par un clic — pour que bouton retour matériel et clic donnent le même résultat)
function closeSearchOverlay() {
    searchOpen = false;
    const bar = document.getElementById('search-bar');
    if (bar) bar.classList.remove('open');
    const main = document.getElementById('main-content');
    if (main) main.classList.remove('search-open');
    hideSearchPanel();
    const input = document.getElementById('search-input');
    if (input) input.value = '';
    const clearBtn = document.getElementById('search-clear');
    if (clearBtn) clearBtn.classList.remove('show');
}

// AJOUT : Fermeture au clic à l'extérieur
document.addEventListener('click', (e) => {
    if (searchJustOpened) return;
    const bar = document.getElementById('search-bar');
    // .closest() fonctionne même sur un nœud détaché (reconstruit par renderSearchFilterPills
    // pendant ce même clic) car il remonte via parentElement, encore intact en mémoire.
    if (searchOpen && bar && !bar.contains(e.target) && !e.target.closest('.search-hit') && !e.target.closest('.search-filter-pill')) {
        history.back();
    }
});

// AJOUT : sur Android, la 1ère pression du bouton retour ferme le clavier sans déclencher
// de navigation JS. Si le clavier se ferme (input perd le focus) alors que le champ est vide,
// on referme aussi la recherche automatiquement — sinon l'écran reste bloqué "ouvert".
document.getElementById('search-input')?.addEventListener('blur', () => {
    if (searchFilterJustClicked) return;
    if (searchOpen && document.getElementById('search-input').value.trim() === '') {
        setTimeout(() => { if (searchOpen) history.back(); }, 100);
    }
});

function showSearchPanel() {
    document.getElementById('search-results').classList.add('open', 'with-bar');
}
function hideSearchPanel() {
    document.getElementById('search-results').classList.remove('open', 'with-bar');
}

/* ══════════════════════════════════════════════════
   RECHERCHE UNIFIÉE — vocab, grammaire, kanji, kana
   ─────────────────────────────────────────────────
   Filtres remis à "Tout"/"Tous" à chaque ouverture (pas de persistance, comme demandé).
   Un léger debounce évite de relancer la recherche à chaque frappe sur les niveaux qui
   nécessitent un fetch réseau (vocab/grammaire non encore en cache).
══════════════════════════════════════════════════ */
// Sélection multiple : un Set vide = "Tout"/"Tous" (aucune restriction). Cocher un type/niveau
// précis désélectionne implicitement "Tout" ; décocher le dernier élément précis y revient.
let searchFilters = { types: new Set(), levels: new Set() };
let searchDebounceTimer = null;
// Mêmes couleurs et caractères que les cartes de l'onglet Apprendre, pour une identité visuelle cohérente
const SEARCH_TYPE_STYLE = {
    vocab:   { label: 'Vocabulaire', color: '#FBBF24', char: '語' },
    grammar: { label: 'Grammaire',   color: '#4ADE80', char: '文' },
    kanji:   { label: 'Kanji',       color: '#00E5FF', char: '字' },
    kana:    { label: 'Kana',        color: '#9D6EFF', char: 'あ' }
};
const SEARCH_RESULTS_CAP  = 25; // par section, pour rester lisible/rapide

function resetSearchFilters() {
    searchFilters = { types: new Set(), levels: new Set() };
    renderSearchFilterPills();
}

function renderSearchFilterPills() {
    const typeEl = document.getElementById('search-filter-type');
    const levelEl = document.getElementById('search-filter-level');
    if (typeEl) {
        const allActive = searchFilters.types.size === 0;
        let html = `<button class="search-filter-pill${allActive ? ' active' : ''}" onclick="toggleSearchFilter('type','all')">Tout</button>`;
        html += Object.entries(SEARCH_TYPE_STYLE).map(([id, s]) => {
            const active = searchFilters.types.has(id);
            return `<button class="search-filter-pill${active ? ' active' : ''}" style="${active ? `border-color:${s.color};color:${s.color}` : ''}" onclick="toggleSearchFilter('type','${id}')">${s.label}</button>`;
        }).join('');
        typeEl.innerHTML = html;
    }
    if (levelEl) {
        const allActive = searchFilters.levels.size === 0;
        const levels = jlptMapping
            ? Object.entries(jlptMapping.levels).sort((a, b) => a[1].order - b[1].order)
            : ALL_JLPT_LEVELS.map(id => [id, { label: id.toUpperCase() }]);
        let html = `<button class="search-filter-pill${allActive ? ' active' : ''}" onclick="toggleSearchFilter('level','all')">Tous</button>`;
        html += levels.map(([id, d]) => {
            const active = searchFilters.levels.has(id);
            return `<button class="search-filter-pill${active ? ' active' : ''}" style="${active && d.color ? `border-color:${d.color};color:${d.color}` : ''}" onclick="toggleSearchFilter('level','${id}')">${d.label}</button>`;
        }).join('');
        levelEl.innerHTML = html;
    }
}

let searchFilterJustClicked = false;
let searchFilterFlagTimer = null;

// Le blur du champ de recherche se déclenche AU MOMENT du appui (mousedown/touchstart),
// avant même que l'événement "click" du bouton ne soit traité — poser le drapeau dans le
// gestionnaire de clic (comme la 1ère tentative) arrivait donc toujours trop tard. On le
// pose ici, au tout premier contact, pour qu'il soit déjà actif quand le blur se produit.
function markSearchFilterInteraction(e) {
    if (e.target.closest('.search-filter-pill')) {
        searchFilterJustClicked = true;
        clearTimeout(searchFilterFlagTimer);
        searchFilterFlagTimer = setTimeout(() => { searchFilterJustClicked = false; }, 300);
    }
}
document.getElementById('search-bar')?.addEventListener('mousedown', markSearchFilterInteraction);
document.getElementById('search-bar')?.addEventListener('touchstart', markSearchFilterInteraction, { passive: true });

function toggleSearchFilter(kind, value) {
    const key = kind === 'type' ? 'types' : 'levels';
    if (value === 'all') {
        searchFilters[key].clear();
    } else if (searchFilters[key].has(value)) {
        searchFilters[key].delete(value);
    } else {
        searchFilters[key].add(value);
    }
    renderSearchFilterPills();
    const q = document.getElementById('search-input')?.value || '';
    if (q.trim()) debouncedDoSearch(q); else clearSearch();
}

function debouncedDoSearch(query) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => doSearch(query), 150);
}

function clearSearch() {
    document.getElementById('search-input').value = '';
    document.getElementById('search-clear').classList.remove('show');
    document.getElementById('search-results').innerHTML =
        '<div class="search-empty"><div class="big">🔎</div>Cherchez un mot, une leçon, un kanji ou un kana</div>';
    showSearchPanel();
}

// Table de conversion kana → romaji pour la recherche
const KANA_TO_ROMAJI = {"あ":"a","い":"i","う":"u","え":"e","お":"o","か":"ka","き":"ki","く":"ku","け":"ke","こ":"ko","さ":"sa","し":"shi","す":"su","せ":"se","そ":"so","た":"ta","ち":"chi","つ":"tsu","て":"te","と":"to","な":"na","に":"ni","ぬ":"nu","ね":"ne","の":"no","は":"ha","ひ":"hi","ふ":"fu","へ":"he","ほ":"ho","ま":"ma","み":"mi","む":"mu","め":"me","も":"mo","や":"ya","ゆ":"yu","よ":"yo","ら":"ra","り":"ri","る":"ru","れ":"re","ろ":"ro","わ":"wa","を":"wo","ん":"n","が":"ga","ぎ":"gi","ぐ":"gu","げ":"ge","ご":"go","ざ":"za","じ":"ji","ず":"zu","ぜ":"ze","ぞ":"zo","だ":"da","ぢ":"di","づ":"du","で":"de","ど":"do","ば":"ba","び":"bi","ぶ":"bu","べ":"be","ぼ":"bo","ぱ":"pa","ぴ":"pi","ぷ":"pu","ぺ":"pe","ぽ":"po","ア":"a","イ":"i","ウ":"u","エ":"e","オ":"o","カ":"ka","キ":"ki","ク":"ku","ケ":"ke","コ":"ko","サ":"sa","シ":"shi","ス":"su","セ":"se","ソ":"so","タ":"ta","チ":"chi","ツ":"tsu","テ":"te","ト":"to","ナ":"na","ニ":"ni","ヌ":"nu","ネ":"ne","ノ":"no","ハ":"ha","ヒ":"hi","フ":"fu","ヘ":"he","ホ":"ho","マ":"ma","ミ":"mi","ム":"mu","メ":"me","モ":"mo","ヤ":"ya","ユ":"yu","ヨ":"yo","ラ":"ra","リ":"ri","ル":"ru","レ":"re","ロ":"ro","ワ":"wa","ヲ":"wo","ン":"n"};
function kanaToRomaji(str) { return [...str].map(c => KANA_TO_ROMAJI[c] || c).join(''); }

const SMALL_Y_TO_ROMAJI = { "ゃ": "ya", "ゅ": "yu", "ょ": "yo", "ャ": "ya", "ュ": "yu", "ョ": "yo" };
// Ces bases perdent le "y" dans la combinaison yōon (しょ -> sho, pas shyo)
const YOON_NO_Y_BASES = new Set(['し', 'じ', 'ち', 'ぢ', 'シ', 'ジ', 'チ', 'ヂ']);

// Convertisseur romaji précis (contrairement à kanaToRomaji ci-dessus, plus basique) : gère la
// gémination (っ double la consonne suivante), l'allongement katakana (ー répète la voyelle
// précédente) et les combinaisons yōon (きゃ -> kya, pas ki+ya). Utilisé pour l'item des fiches
// grammaire — jamais pour du texte contenant du kanji (voir getItemRomaji ci-dessous).
function kanaToRomajiPrecise(str) {
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

// Romaji de l'item d'une leçon de grammaire — utilise item_romaji si le champ existe (ajouté
// manuellement pour les items contenant du kanji, non convertibles automatiquement), sinon génère
// automatiquement pour les items en kana pur. Vide si ni l'un ni l'autre n'est disponible.
function getItemRomaji(item, explicitRomaji) {
    if (explicitRomaji) return explicitRomaji;
    if (!item) return '';
    const first = item.split('/')[0].trim().replace(/^〜/, '');
    if (!first || hasKanjiChar(first)) return '';
    return kanaToRomajiPrecise(first);
}

// ── Recherche par type (chacune retourne un tableau d'items bruts, pas encore rendus) ──

function searchKanjiItems(q, levels) {
    return kanjiDb.filter(k => {
        if (!levels.includes(`n${getJLPTLevel(k.grade)}`)) return false;
        if (k.char === q) return true;
        if (k.meanings.some(m => m.toLowerCase().includes(q))) return true;
        if (k.on.some(r => r.toLowerCase().includes(q))) return true;
        if (k.kun.some(r => r.replace(/[.\-].*/g, '').toLowerCase().includes(q))) return true;
        if (k.on.some(r => kanaToRomaji(r.toLowerCase()).includes(q))) return true;
        if (k.kun.some(r => kanaToRomaji(r.replace(/[.\-].*/g, '')).includes(q))) return true;
        if (k.romaji && k.romaji.toLowerCase().includes(q)) return true;
        return false;
    }).slice(0, SEARCH_RESULTS_CAP);
}

// Cherche uniquement dans : word, reading, romaji, meanings (primary/secondary) — jamais dans
// les exemples de phrases, qui ne font pas partie du champ de recherche voulu.
function searchVocabItems(items, q) {
    return items.filter(w => {
        if (w.word && w.word.includes(q)) return true;
        if (w.reading && w.reading.includes(q)) return true;
        if (w.romaji && w.romaji.toLowerCase().includes(q)) return true;
        const m = w.meanings;
        if (m) {
            if (typeof m === 'string' && m.toLowerCase().includes(q)) return true;
            if (m.primary && m.primary.toLowerCase().includes(q)) return true;
            if (Array.isArray(m.secondary) && m.secondary.some(s => s.toLowerCase().includes(q))) return true;
        }
        return false;
    }).slice(0, SEARCH_RESULTS_CAP);
}

// Cherche uniquement dans : item, item_romaji, pattern, title, unit_title, badge — jamais dans
// le contenu des sections (explications) ni dans les exemples de phrases.
function searchGrammarItems(items, q) {
    return items.filter(l => {
        if (l.item && l.item.toLowerCase().includes(q)) return true;
        if (l.item_romaji && l.item_romaji.toLowerCase().includes(q)) return true;
        if (l.pattern && l.pattern.toLowerCase().includes(q)) return true;
        if (l.title && l.title.toLowerCase().includes(q)) return true;
        if (l.unit_title && l.unit_title.toLowerCase().includes(q)) return true;
        if (l.badge && l.badge.toLowerCase().includes(q)) return true;
        return false;
    }).slice(0, SEARCH_RESULTS_CAP);
}

function searchKanaItems(q) {
    const all = [...getKanaFlatList('hira'), ...getKanaFlatList('kata')];
    return all.filter(k =>
        k.char === q || (k.romaji && k.romaji.toLowerCase().includes(q))
    ).slice(0, SEARCH_RESULTS_CAP);
}

async function performUnifiedSearch(q, filters) {
    const results = { kanji: [], vocab: [], grammar: [], kana: [] };
    const activeTypes = filters.types.size ? filters.types : new Set(['vocab', 'grammar', 'kanji', 'kana']);
    const levels = filters.levels.size ? [...filters.levels] : ALL_JLPT_LEVELS;

    if (activeTypes.has('kanji')) {
        results.kanji = searchKanjiItems(q, levels);
    }
    if (activeTypes.has('kana')) {
        // Le kana n'a pas de notion de niveau JLPT propre — toujours cherché tant que le type
        // sélectionné l'inclut (déjà géré par la condition ci-dessus), peu importe le filtre niveau.
        results.kana = searchKanaItems(q);
    }
    if (activeTypes.has('vocab')) {
        for (const level of levels) {
            const vd = await getLevelVocabData(level);
            if (vd && vd.data) results.vocab.push(...searchVocabItems(vd.data, q).map(w => ({ ...w, _level: level })));
        }
        results.vocab = results.vocab.slice(0, SEARCH_RESULTS_CAP);
    }
    if (activeTypes.has('grammar')) {
        for (const level of levels) {
            const gd = await getLevelGrammarData(level);
            if (gd && gd.data) results.grammar.push(...searchGrammarItems(gd.data, q).map(l => ({ ...l, _level: level })));
        }
        results.grammar = results.grammar.slice(0, SEARCH_RESULTS_CAP);
    }
    return results;
}

function buildSearchSection(type, itemsHtml) {
    if (!itemsHtml.length) return '';
    const s = SEARCH_TYPE_STYLE[type];
    return `<div class="search-section">
        <div class="search-section-title">
            <span class="search-section-icon" style="background:${s.color}22;color:${s.color}">${s.char}</span>
            ${s.label} <span class="search-section-count">${itemsHtml.length}</span>
        </div>
        ${itemsHtml.join('')}
    </div>`;
}

function renderSearchResults(results, query) {
    const el = document.getElementById('search-results');
    const total = results.kanji.length + results.vocab.length + results.grammar.length + results.kana.length;

    if (total === 0) {
        el.innerHTML = `<div class="search-empty"><div class="big">🙅</div>Aucun résultat pour « ${query} »</div>`;
        return;
    }

    let html = '';
    html += buildSearchSection('vocab', results.vocab.map(buildVocabHitHtml));
    html += buildSearchSection('grammar', results.grammar.map(buildGrammarHitHtml));
    html += buildSearchSection('kanji', results.kanji.map(buildKanjiHitHtml));
    html += buildSearchSection('kana', results.kana.map(buildKanaHitHtml));
    el.innerHTML = html;
}

function buildVocabHitHtml(w) {
    const meaning = (w.meanings && (w.meanings.primary || w.meanings)) || '';
    const typeColor = SEARCH_TYPE_STYLE.vocab.color;
    const levelColor = (jlptMapping && jlptMapping.levels[w._level]) ? jlptMapping.levels[w._level].color : typeColor;
    return `<div class="search-hit" onclick="openVocabFromSearch('${w.id}','${w._level}')">
        <div class="search-hit-char-word" style="color:${typeColor};background:${typeColor}18;border:1px solid ${typeColor}40">${w.word || ''}</div>
        <div class="search-hit-info">
            <div class="search-hit-meaning">${meaning}</div>
            <div class="search-hit-readings">${w.reading || ''}${w.romaji ? ' · ' + w.romaji : ''}</div>
        </div>
        <span class="search-hit-badge" style="background:${levelColor}22;color:${levelColor};border:1px solid ${levelColor}44">${w._level.toUpperCase()}</span>
    </div>`;
}

function buildGrammarHitHtml(l) {
    const typeColor = SEARCH_TYPE_STYLE.grammar.color;
    const levelColor = (jlptMapping && jlptMapping.levels[l._level]) ? jlptMapping.levels[l._level].color : typeColor;
    return `<div class="search-hit" onclick="openGrammarFromSearch('${l.id}','${l._level}')">
        <div class="search-hit-char-word" style="color:${typeColor};background:${typeColor}18;border:1px solid ${typeColor}40">${l.item || l.pattern || ''}</div>
        <div class="search-hit-info">
            <div class="search-hit-meaning">${l.title || ''}</div>
            <div class="search-hit-readings">${l.pattern && l.pattern !== l.item ? l.pattern : ''}</div>
        </div>
        <span class="search-hit-badge" style="background:${levelColor}22;color:${levelColor};border:1px solid ${levelColor}44">${l._level.toUpperCase()}</span>
    </div>`;
}

function buildKanjiHitHtml(k) {
    const safeChar = k.char.replace(/'/g, "\\'");
    const level = getJLPTLevel(k.grade);
    const typeColor = SEARCH_TYPE_STYLE.kanji.color;
    const levelColor = (jlptMapping && jlptMapping.levels['n' + level]) ? jlptMapping.levels['n' + level].color : typeColor;
    return `<div class="search-hit" onclick="openDetail(kanjiDb[kanjiMap.get('${safeChar}')]);closeSearchOverlay();">
        <div class="search-hit-char" style="color:${typeColor};background:${typeColor}18;border:1px solid ${typeColor}40">${k.char}</div>
        <div class="search-hit-info">
            <div class="search-hit-meaning">${k.meanings[0]}${k.meanings[1] ? ' · ' + k.meanings[1] : ''}</div>
            <div class="search-hit-readings">${[...k.on.slice(0, 3), ...k.kun.slice(0, 2)].join('  ')}</div>
        </div>
        <span class="search-hit-badge" style="background:${levelColor}22;color:${levelColor};border:1px solid ${levelColor}44">N${level}</span>
    </div>`;
}

function buildKanaHitHtml(k) {
    const typeColor = SEARCH_TYPE_STYLE.kana.color;
    return `<div class="search-hit" onclick='openKanaDetail(${JSON.stringify(k)});closeSearchOverlay();'>
        <div class="search-hit-char" style="color:${typeColor};background:${typeColor}18;border:1px solid ${typeColor}40">${k.char}</div>
        <div class="search-hit-info">
            <div class="search-hit-meaning">${k.romaji || ''}</div>
        </div>
    </div>`;
}

// Ouvre une fiche vocab "à froid" (sans être passé par la liste de son niveau au préalable) —
// même principe qu'openDetail() pour le kanji, qui fonctionne déjà ainsi.
async function openVocabFromSearch(wordId, level) {
    const vd = await getLevelVocabData(level);
    if (!vd || !vd.data) return;
    vocabHomeData = { levelId: level, data: vd.data, examples: vd.examples };
    closeAllOverlaysAndSessions(); // pas juste closeSearchOverlay() : peut aussi être appelée depuis la fiche kanji (#detail-view), un overlay différent
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    showVocabDetail(wordId, vd.data);
}

async function openGrammarFromSearch(lessonId, level) {
    const gd = await getLevelGrammarData(level);
    if (!gd || !gd.data) return;
    grammarHomeData = { levelId: level, data: gd.data };
    closeAllOverlaysAndSessions();
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    showGrammarDetail(lessonId);
}

async function doSearch(query) {
    const q = query.trim().toLowerCase();
    document.getElementById('search-clear').classList.toggle('show', q.length > 0);
    if (!q) { clearSearch(); return; }
    showSearchPanel();

    const results = await performUnifiedSearch(q, searchFilters);
    // Si l'utilisateur a continué à taper pendant le fetch, on ignore ce résultat périmé
    if (document.getElementById('search-input').value.trim().toLowerCase() !== q) return;
    renderSearchResults(results, query);
}

// LOGIQUE MICRO RECHERCHE — supporte japonais et français
function initMicSearch() {
    const micBtn = document.getElementById('mic-search-trigger');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!micBtn || !SR) {
        if (micBtn) { micBtn.style.opacity = '0.3'; micBtn.title = 'Reconnaissance vocale non supportée'; }
        return;
    }
    let isListening = false;
    micBtn.onclick = (e) => {
        e.stopPropagation();
        if (isListening) return;
        isListening = true;
        micBtn.classList.add('listening');
        // Langue auto : si champ vide ou dernière requête en latin → FR, sinon JP
        const inputVal = document.getElementById('search-input').value;
        const isLatin = /^[a-zA-ZÀ-ÿ\s]*$/.test(inputVal.trim());
        const langOrder = isLatin ? ['fr-FR', 'ja-JP'] : ['ja-JP', 'fr-FR'];
        const rec = new SR();
        rec.continuous = false;
        rec.interimResults = false;
        rec.maxAlternatives = 3;
        rec.lang = langOrder[0];
        rec.start();
        rec.onresult = (ev) => {
            // Tenter la meilleure alternative parmi les 3
            let best = '';
            for (let i = 0; i < ev.results[0].length; i++) {
                const t = ev.results[0][i].transcript.trim();
                if (t.length > best.length) best = t;
            }
            if (best) {
                document.getElementById('search-input').value = best;
                document.getElementById('search-clear').classList.add('show');
                doSearch(best);
            }
        };
        rec.onerror = (ev) => { console.warn('Mic error:', ev.error); };
        rec.onend = () => { micBtn.classList.remove('listening'); isListening = false; };
    };
}
setTimeout(initMicSearch, 300);

/* ══════════════════════════════════════════════════
   SYSTÈME DE DOSSIERS / FAVORIS
   Stockage : localStorage clé 'kanji_folders_v1'
   Structure : { "Animaux": ["猫","犬"], ... }
══════════════════════════════════════════════════ */
const FOLDERS_KEY = 'kanji_folders_v1';

function loadFolders() {
    try { return JSON.parse(localStorage.getItem(FOLDERS_KEY)) || {}; }
    catch(_) { return {}; }
}

function saveFolders(folders) {
    try { localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders)); }
    catch(e) { console.warn('Folders save error:', e); }
}

function isKanjiInAnyFolder(char) {
    const f = loadFolders();
    return Object.values(f).some(arr => arr.includes(char));
}

function getFoldersContaining(char) {
    const f = loadFolders();
    return Object.keys(f).filter(name => f[name].includes(char));
}

function addKanjiToFolder(char, folderName) {
    const f = loadFolders();
    if (!f[folderName]) f[folderName] = [];
    if (!f[folderName].includes(char)) f[folderName].push(char);
    saveFolders(f);
}

function removeKanjiFromFolder(char, folderName) {
    const f = loadFolders();
    if (f[folderName]) {
        f[folderName] = f[folderName].filter(c => c !== char);
        if (f[folderName].length === 0) delete f[folderName];
    }
    saveFolders(f);
}

function renameFolder(oldName, newName) {
    if (!newName || oldName === newName) return false;
    const f = loadFolders();
    if (!f[oldName]) return false;
    if (f[newName]) return false; // doublon
    f[newName] = f[oldName];
    delete f[oldName];
    saveFolders(f);
    return true;
}

function deleteFolder(name) {
    const f = loadFolders();
    delete f[name];
    saveFolders(f);
}

// ── Modal dossiers ─────────────────────────────
let _fmChar = null;

function openFolderModal(char) {
    if (!char) return;
    _fmChar = char;
    document.getElementById('fm-kanji-label').textContent = `Kanji : ${char}`;
    document.getElementById('fm-new-inp').value = '';
    renderFolderModalList(char);
    document.getElementById('folder-modal').classList.add('open');
}

function closeFolderModal() {
    document.getElementById('folder-modal').classList.remove('open');
    _fmChar = null;
}

function renderFolderModalList(char) {
    const f       = loadFolders();
    const names   = Object.keys(f);
    const inList  = getFoldersContaining(char);
    const list    = document.getElementById('fm-folder-list');

    let html = '';

    // Bouton "Créer un nouveau dossier"
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

function toggleKanjiInFolder(char, folderName) {
    const inList = getFoldersContaining(char);
    if (inList.includes(folderName)) {
        removeKanjiFromFolder(char, folderName);
    } else {
        addKanjiToFolder(char, folderName);
    }
    renderFolderModalList(char);
    updateSaveBtnState(char);
}

function toggleFmNewRow() {
    const row = document.getElementById('fm-new-row');
    const inp = document.getElementById('fm-new-inp');
    const isHidden = row.style.display === 'none';
    row.style.display = isHidden ? '' : 'none';
    if (isHidden) setTimeout(() => inp.focus(), 50);
}

function confirmNewFolder() {
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

// ── Bouton ⭐ dans la fiche ─────────────────────
function updateSaveBtnState(char) {
    const btn  = document.getElementById('btn-save-kanji');
    const icon = document.getElementById('save-icon');
    if (!btn || !icon) return;
    const saved = isKanjiInAnyFolder(char);
    icon.textContent = saved ? '★' : '⭐';
    btn.classList.toggle('saved', saved);
    btn.title = saved ? 'Enregistré — cliquer pour modifier' : 'Enregistrer dans un dossier';
}

// ── Page "Mes Dossiers" ─────────────────────────
function navFolders() {
    document.getElementById('page-title').innerText = '📁 Mes Dossiers';
    renderFoldersPage();
}

function renderFoldersPage() {
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

    // Bouton "Créer un dossier vide"
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

function getKanjiMeaning(char) {
    const k = kanjiDb.find(k => k.char === char);
    if (!k) return char;
    return k.meanings.filter(m => !m.toLowerCase().includes('radical'))[0] || k.meanings[0] || '';
}

function openKanjiFromChar(char) {
    const idx = kanjiMap.get(char);
    if (idx === undefined) return;
    openDetail(kanjiDb[idx]);
}

function promptCreateEmptyFolder() {
    const name = prompt('Nom du nouveau dossier :');
    if (!name || !name.trim()) return;
    const f = loadFolders();
    if (!f[name.trim()]) { f[name.trim()] = []; saveFolders(f); }
    renderFoldersPage();
}

function promptRenameFolder(oldName) {
    const newName = prompt(`Renommer "${oldName}" en :`, oldName);
    if (!newName || !newName.trim() || newName.trim() === oldName) return;
    if (!renameFolder(oldName, newName.trim())) {
        alert('Un dossier avec ce nom existe déjà.');
        return;
    }
    renderFoldersPage();
}

function promptDeleteFolder(name) {
    if (!confirm(`Supprimer le dossier "${name}" ?\nLes kanjis ne seront pas supprimés, seulement le dossier.`)) return;
    deleteFolder(name);
    renderFoldersPage();
}

function startFolderQuiz(folderName) {
    const folders = loadFolders();
    const chars   = folders[folderName];
    if (!chars || chars.length < 2) {
        alert('Il faut au moins 2 kanjis dans le dossier pour lancer un quiz.');
        return;
    }
    // Construire un pool ad hoc d'indices
    const indices = chars.map(c => kanjiMap.get(c)).filter(i => i !== undefined);
    if (indices.length < 2) return;

    // Stocker temporairement dans quizState en utilisant startQuiz avec type 'folder'
    // On passe par un mode catégorie inline
    const tempId = '__folder__' + folderName;
    // Créer une entrée temporaire dans les catégories
    categories.set(tempId, { id: tempId, label: `📁 ${folderName}`, short: '📁', indices, color: '#f5a623' });
    showQuizModeModal('category', tempId);
}

/* ══════════════════════════════════════════════════
   SIDEBAR
══════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════
   LEVEL CATEGORY SELECTOR — Onglets Kanji | Vocab | Grammar
══════════════════════════════════════════════════ */
// Remplace l'ancien sélecteur à onglets : chaque catégorie a maintenant son propre point d'entrée
// (Lexique → Vocab, Apprendre → Grammaire, Apprendre → Kanji), donc plus besoin de tabs — juste
// un en-tête discret avec retour + titre + stats, façon Hibi.
async function showCategoryDirect(levelId, category, isBack = false) {
    if (!jlptMapping || !jlptMapping.levels[levelId]) return;
    
    if (!isBack) history.pushState({ view: 'category-direct', levelId, category }, '');
    
    currentJLPTLevel = levelId;
    const levelData = jlptMapping.levels[levelId];
    const mainContent = document.getElementById('main-content');
    
    const catLabels = { kanji: 'Kanji', vocab: 'Vocabulaire', grammar: 'Grammaire' };
    const catLabel = catLabels[category] || category;
    const backFn = category === 'vocab' ? 'showNiveauxScreen' : category === 'grammar' ? 'showGrammarNiveauxScreen' : 'showKanjiNiveauxScreen';
    
    // Sous-titre : stats réelles si disponibles, sinon la description du niveau
    let subtitle = levelData.description;
    if (category === 'vocab' || category === 'grammar') {
        const vg = await getLevelVocabGrammarStats(levelId);
        if (category === 'vocab' && vg.vocabTotal > 0) subtitle = `${vg.vocabTotal} mots · ${vg.vocabMastered} maîtrisés`;
        if (category === 'grammar' && vg.grammarTotal > 0) subtitle = `${vg.grammarTotal} leçons · ${vg.grammarMastered} maîtrisées`;
    } else if (category === 'kanji') {
        const chars = await getLevelKanjiChars(levelId);
        subtitle = `${chars ? chars.length : 0} kanji`;
    }
    
    mainContent.innerHTML = `
        <div class="cat-header">
            <button class="back-btn" onclick="closeAllOverlaysAndSessions(); ${backFn}()">←</button>
            <div class="cat-header-info">
                <div class="cat-header-title">${catLabel} ${levelData.label}</div>
                <div class="cat-header-sub">${subtitle}</div>
            </div>
        </div>
        <div id="category-content" style="padding:16px">
            <div style="text-align:center;color:var(--gray);margin-top:40px">
                <div class="spinner" style="margin-bottom:16px"></div>
                Chargement…
            </div>
        </div>`;
    
    loadJLPTCategory(levelId, category, true);
}

async function loadJLPTCategory(levelId, category, isBack = false) {
    const container = document.getElementById('category-content');
    if (!container) return;
    
    try {
        container.innerHTML = '<div style="text-align:center;color:var(--gray)"><div class="spinner" style="margin-bottom:16px"></div>Chargement…</div>';
        
        // Charger le fichier JSON correspondant
        const url = `./data/${levelId}/${category}.json`;
        const res = await fetch(url, { cache: 'no-store' });
        
        if (!res.ok) {
            throw new Error(`Fichier non trouvé : ${url}`);
        }
        
        const data = flattenIfNested(await res.json());
        
        // Charger aussi les exemples si c'est vocab ou grammar
        let examples = null;
        if (category === 'vocab' || category === 'grammar') {
            try {
                const exRes = await fetch(`./data/${levelId}/exemples.json`, { cache: 'no-store' });
                if (exRes.ok) {
                    examples = await exRes.json();
                }
            } catch (e) {
                console.warn(`Exemples non trouvés pour ${levelId}:`, e);
            }
        }
        
        // Afficher selon la catégorie
        if (category === 'kanji') {
            displayKanjiList(levelId, data, isBack);
        } else if (category === 'vocab') {
            displayVocabList(levelId, data, examples, isBack);
        } else if (category === 'grammar') {
            showGrammarHome(levelId, data, examples, isBack);
        }
        
    } catch (e) {
        container.innerHTML = `<div style="color:#e55;font-size:0.8125rem;padding:20px;text-align:center">Erreur : ${e.message}</div>`;
        console.error('loadJLPTCategory error:', e);
    }
}

function displayKanjiList(levelId, data, isBack = false) {
    const container = document.getElementById('category-content');
    if (!data.chars || !Array.isArray(data.chars)) {
        container.innerHTML = '<div style="color:var(--gray)">Structure invalide</div>';
        return;
    }
    
    if (!isBack) history.pushState({ view: 'kanji-list' }, '');
    
    kanjiHomeData = { levelId, chars: data.chars };
    currentLevelId = levelId;
    
    const dueCount = countDueItems(data.chars.map(c => ({ id: c })));
    
    // Créer une grille de kanji cliquables
    const grid = data.chars.map(char => {
        const kanjiData = kanjiDb.find(k => k.char === char);
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
            ${!bulkSelectMode ? `<button class="bulk-select-toggle-btn" onclick="enterBulkSelectMode(() => displayKanjiList('${levelId}', {chars: kanjiHomeData.chars}, true))">☑ Sélectionner</button>` : ''}
        </div>
        ${bulkSelectMode ? `
        <label class="bulk-cat-row-standalone">
            <input type="checkbox" class="bulk-cat-checkbox" onclick='toggleCategoryMasteryLive(this, ${JSON.stringify(data.chars)})' ${data.chars.every(c => getItemStatus(c) === 'mastered') ? 'checked' : ''}>
            <span>Tout ce niveau</span>
        </label>` : ''}
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:8px;margin-top:12px">
            ${grid}
        </div>`;
}

function displayKanjiListFromHome() {
    if (kanjiHomeData) loadJLPTCategory(kanjiHomeData.levelId, 'kanji', true);
}

function getDueKanjiChars() {
    const chars = kanjiHomeData?.chars || [];
    return buildDueQueue(chars.map(c => ({ id: c }))).map(item => item.id);
}

/* ══════════════════════════════════════════════════
   RÉVISION KANJI — sélecteur de mode + flashcard + 2 tracés (SRS partagé)
══════════════════════════════════════════════════ */
function showKanjiReviewModeSelector() {
    const container = document.getElementById('category-content');
    const dueChars = getDueKanjiChars();
    
    if (dueChars.length === 0) {
        alert('Rien à réviser pour le moment ! 🎉');
        return;
    }
    
    pushModalState('kanji-review-selector');
    
    container.innerHTML = `
        <div class="review-mode-selector">
            <button class="back-btn" onclick="history.back()">←</button>
            <div class="review-mode-title">Choisis ton mode de révision</div>
            <div class="review-mode-count">${dueChars.length} kanji à revoir</div>
            
            <button class="review-mode-btn" onclick="startKanjiFlashcardReview()">
                <span class="review-mode-icon">🗂️</span>
                <div><div class="review-mode-name">Flashcard</div><div class="review-mode-desc">Lecture et sens</div></div>
            </button>
            <button class="review-mode-btn" onclick="startKanjiTraceReview('trace-easy')">
                <span class="review-mode-icon">✍️</span>
                <div><div class="review-mode-name">Tracé normal</div><div class="review-mode-desc">Avec assistance</div></div>
            </button>
            <button class="review-mode-btn" onclick="startKanjiTraceReview('trace-hard')">
                <span class="review-mode-icon">🔥</span>
                <div><div class="review-mode-name">Tracé difficile</div><div class="review-mode-desc">Sans assistance (hardcore)</div></div>
            </button>
            <button class="review-mode-btn" onclick="showFreeTrainingConfig(false, {type:'kanji', level: kanjiHomeData?.levelId})">
                <span class="review-mode-icon">🏋️</span>
                <div><div class="review-mode-name">Entraînement libre</div><div class="review-mode-desc">Configurable, sans impact sur le SRS</div></div>
            </button>
        </div>`;
}

function startKanjiTraceReview(mode) {
    const dueChars = getDueKanjiChars();
    if (dueChars.length === 0) return;
    startStrokeQuiz({ type: 'queue', id: dueChars, mode });
}

function startKanjiFlashcardReview() {
    const dueChars = getDueKanjiChars();
    if (dueChars.length === 0) return;
    
    pushModalState('kanji-review-flashcard');
    
    kanjiReviewSession = {
        queue: dueChars,
        index: 0,
        results: { again: 0, hard: 0, good: 0, easy: 0 },
        flipped: false
    };
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    renderKanjiReviewScreen();
}

function renderKanjiReviewScreen() {
    const container = document.getElementById('category-content');
    const session = kanjiReviewSession;
    
    if (!session || session.index >= session.queue.length) {
        renderKanjiReviewSummary();
        return;
    }
    
    const char = session.queue[session.index];
    const kanjiData = kanjiDb.find(k => k.char === char);
    const progress = session.index + 1;
    const total = session.queue.length;
    const flipped = session.flipped;
    
    const meanings = (kanjiData?.meanings || []).filter(m => !m.toLowerCase().includes('radical'));
    const onReadings = kanjiData?.on || [];
    const kunReadings = kanjiData?.kun || [];
    
    container.innerHTML = `<div class="review-page">
        <div class="review-header">
            <button class="back-btn" onclick="history.back()">✕</button>
            <div class="review-progress-bar"><div class="review-progress-fill" style="width:${(session.index / total) * 100}%"></div></div>
            <div class="review-progress-text">${progress} / ${total}</div>
        </div>
        
        <div class="review-card ${flipped ? 'flipped' : ''}" onclick="${flipped ? '' : 'flipKanjiReviewCard()'}">
            <div class="review-card-front">
                <div class="review-word" style="font-size:3.5rem;">${char}</div>
            </div>
            ${flipped ? `
                <div class="review-card-back">
                    ${onReadings.length ? `<div class="review-romaji">On : ${onReadings.slice(0, 3).join('、')}</div>` : ''}
                    ${kunReadings.length ? `<div class="review-romaji">Kun : ${kunReadings.slice(0, 3).join('、')}</div>` : ''}
                    <div class="review-meaning">${meanings.slice(0, 3).join(' / ') || '–'}</div>
                </div>
            ` : `<div class="review-tap-hint">Touche la carte pour révéler</div>`}
        </div>
        
        ${flipped ? `
            <div class="review-grade-buttons">
                <button class="grade-btn grade-again" onclick="submitKanjiReviewGrade(0)">Encore</button>
                <button class="grade-btn grade-hard" onclick="submitKanjiReviewGrade(1)">Difficile</button>
                <button class="grade-btn grade-good" onclick="submitKanjiReviewGrade(2)">Bien</button>
                <button class="grade-btn grade-easy" onclick="submitKanjiReviewGrade(3)">Facile</button>
            </div>
        ` : ''}
    </div>`;
}

function flipKanjiReviewCard() {
    if (!kanjiReviewSession) return;
    kanjiReviewSession.flipped = true;
    renderKanjiReviewScreen();
}

function submitKanjiReviewGrade(quality) {
    if (!kanjiReviewSession) return;
    const char = kanjiReviewSession.queue[kanjiReviewSession.index];
    gradeReview(char, quality, { type: 'kanji', label: char });
    if (quality === 0) scheduleRelearning(kanjiReviewSession, char);
    
    const labels = ['again', 'hard', 'good', 'easy'];
    kanjiReviewSession.results[labels[quality]]++;
    
    kanjiReviewSession.index++;
    kanjiReviewSession.flipped = false;
    renderKanjiReviewScreen();
}

function renderKanjiReviewSummary() {
    recordSessionCompleted();
    const container = document.getElementById('category-content');
    const r = kanjiReviewSession.results;
    const total = kanjiReviewSession.queue.length;
    
    container.innerHTML = `<div class="review-summary">
        <div class="review-summary-title">Session terminée ! 🎉</div>
        <div class="review-summary-count">${total} kanji révisé${total > 1 ? 's' : ''}</div>
        <div class="review-summary-stats">
            <div class="review-stat"><span class="review-stat-dot again"></span>Encore : ${r.again}</div>
            <div class="review-stat"><span class="review-stat-dot hard"></span>Difficile : ${r.hard}</div>
            <div class="review-stat"><span class="review-stat-dot good"></span>Bien : ${r.good}</div>
            <div class="review-stat"><span class="review-stat-dot easy"></span>Facile : ${r.easy}</div>
        </div>
        <button class="revise-btn" style="margin-top:20px;" onclick="history.back()">Retour aux kanji</button>
    </div>`;
    kanjiReviewSession = null;
}

/* ══════════════════════════════════════════════════
   ÉCRAN DE RÉVISION VOCABULAIRE (flashcard + QCM + trou à combler + SRS)
══════════════════════════════════════════════════ */
let reviewSession = null; // { queue: [{word, type, clozeInfo, qcmInfo}], index, results, flipped, answered, selected }

const COMMON_PARTICLES = ['は', 'が', 'を', 'に', 'で', 'と', 'へ', 'も', 'から', 'まで', 'の'];

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function getPrimaryMeaning(word) {
    const m = word.meanings;
    if (m && typeof m === 'object' && !Array.isArray(m)) return m.primary || 'Sens';
    if (Array.isArray(m)) return m[0] || 'Sens';
    return m || 'Sens';
}

// Génère un exercice "trou à combler" sur une particule, seulement si elle apparaît
// réellement comme token isolé dans l'exemple (sinon on ne peut pas garantir un exercice correct)
function buildClozeParticle(word) {
    const particles = word.particles || [];
    const jp = (word.example && word.example.japanese) || '';
    const tokens = jp.split(/\s+/).filter(Boolean);
    const validParticle = particles.find(p => tokens.includes(p));
    if (!validParticle) return null;
    
    const blankIndex = tokens.indexOf(validParticle);
    const distractorPool = COMMON_PARTICLES.filter(p => p !== validParticle);
    const distractors = shuffleArray(distractorPool).slice(0, 3);
    const options = shuffleArray([validParticle, ...distractors]);
    
    return { tokens, blankIndex, correct: validParticle, options };
}

// Génère un QCM sur le sens du mot, avec 3 distracteurs pris ailleurs dans le pool
function buildMeaningQCM(word, pool) {
    const primary = getPrimaryMeaning(word);
    const others = pool.filter(w => w.id !== word.id && getPrimaryMeaning(w) && getPrimaryMeaning(w) !== primary);
    if (others.length < 3) return null;
    
    const distractors = shuffleArray(others).slice(0, 3).map(getPrimaryMeaning);
    const options = shuffleArray([primary, ...distractors]);
    return { correct: primary, options };
}

function prepareSessionItem(word, pool, forceMode = null) {
    const clozeInfo = buildClozeParticle(word);
    const qcmInfo = buildMeaningQCM(word, pool);
    
    let type = 'flashcard';
    if (forceMode === 'flashcard') {
        type = 'flashcard';
    } else if (forceMode === 'quiz') {
        // Force un exercice actif (trous en priorité, sinon QCM) ; repli flashcard seulement
        // si le mot n'a ni particule ni distracteurs suffisants pour générer l'un ou l'autre.
        type = clozeInfo ? 'cloze' : (qcmInfo ? 'qcm' : 'flashcard');
    } else {
        const r = Math.random();
        if (clozeInfo && r < 0.35) type = 'cloze';
        else if (qcmInfo && r < 0.7) type = 'qcm';
    }
    
    return { word, type, clozeInfo, qcmInfo };
}

function showVocabReviewModeSelector() {
    const container = document.getElementById('category-content');
    const data = vocabHomeData?.data || [];
    const dueWords = buildDueQueue(data);

    if (dueWords.length === 0) {
        alert('Rien à réviser pour le moment ! 🎉');
        return;
    }

    pushModalState('vocab-review-selector');

    container.innerHTML = `
        <div class="review-mode-selector">
            <button class="back-btn" onclick="history.back()">←</button>
            <div class="review-mode-title">Choisis ton mode de révision</div>
            <div class="review-mode-count">${dueWords.length} mot${dueWords.length > 1 ? 's' : ''} à revoir</div>

            <button class="review-mode-btn" onclick="startVocabReview()">
                <span class="review-mode-icon">🎲</span>
                <div><div class="review-mode-name">Mixte</div><div class="review-mode-desc">Flashcard, trous et QCM mélangés</div></div>
            </button>
            <button class="review-mode-btn" onclick="startVocabReview('flashcard')">
                <span class="review-mode-icon">🗂️</span>
                <div><div class="review-mode-name">Flashcard</div><div class="review-mode-desc">Lecture et sens, auto-évalué</div></div>
            </button>
            <button class="review-mode-btn" onclick="startVocabReview('quiz')">
                <span class="review-mode-icon">✍️</span>
                <div><div class="review-mode-name">Quiz actif</div><div class="review-mode-desc">Trous et QCM uniquement</div></div>
            </button>
            <button class="review-mode-btn" onclick="showFreeTrainingConfig(false, {type:'vocab', level: vocabHomeData?.levelId})">
                <span class="review-mode-icon">🏋️</span>
                <div><div class="review-mode-name">Entraînement libre</div><div class="review-mode-desc">Configurable, sans impact sur le SRS</div></div>
            </button>
        </div>`;
}

function startVocabReview(forceMode = null) {
    const data = vocabHomeData?.data || [];
    const dueWords = buildDueQueue(data);
    
    if (dueWords.length === 0) {
        alert('Rien à réviser pour le moment ! 🎉');
        return;
    }
    
    const queue = dueWords.map(w => prepareSessionItem(w, data, forceMode));
    
    pushModalState('vocab-review');
    
    reviewSession = {
        queue,
        index: 0,
        results: { again: 0, hard: 0, good: 0, easy: 0 },
        flipped: false,
        answered: false,
        selected: null
    };
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    renderReviewScreen();
}

function renderReviewScreen() {
    const container = document.getElementById('category-content');
    const session = reviewSession;
    
    if (!session || session.index >= session.queue.length) {
        renderReviewSummary();
        return;
    }
    
    const entry = session.queue[session.index];
    const { word, type } = entry;
    const progress = session.index + 1;
    const total = session.queue.length;
    
    let bodyHtml = '';
    if (type === 'cloze') {
        bodyHtml = renderClozeExercise(entry, session);
    } else if (type === 'qcm') {
        bodyHtml = renderQcmExercise(entry, session);
    } else {
        bodyHtml = renderFlashcardExercise(entry, session);
    }
    
    container.innerHTML = `<div class="review-page">
        <div class="review-header">
            <button class="back-btn" onclick="history.back()">✕</button>
            <div class="review-progress-bar"><div class="review-progress-fill" style="width:${(session.index / total) * 100}%"></div></div>
            <div class="review-progress-text">${progress} / ${total}</div>
        </div>
        ${bodyHtml}
    </div>`;
}

// ── FLASHCARD (rappel libre, auto-évalué par l'utilisateur) ──
function renderFlashcardExercise(entry, session) {
    const { word } = entry;
    const primaryMeaning = getPrimaryMeaning(word);
    const flipped = session.flipped;
    
    return `
        <div class="review-card ${flipped ? 'flipped' : ''}" onclick="${flipped ? '' : 'flipReviewCard()'}">
            <div class="review-card-front">
                <div class="review-word">${word.word || ''}</div>
                ${flipped ? `<div class="review-reading">${word.reading || ''}</div>` : ''}
            </div>
            ${flipped ? `
                <div class="review-card-back">
                    <div class="review-romaji">${word.romaji || ''}</div>
                    <div class="review-meaning">${mdBold(primaryMeaning)}</div>
                    ${word.example && word.example.japanese ? `
                        <div class="review-example">
                            <div class="example-jp">${mdBold(word.example.japanese)}</div>
                            <div class="example-fr">${mdBold(word.example.french || '')}</div>
                        </div>
                    ` : ''}
                </div>
            ` : `<div class="review-tap-hint">Touche la carte pour révéler</div>`}
        </div>
        ${flipped ? `
            <div class="review-grade-buttons">
                <button class="grade-btn grade-again" onclick="submitReviewGrade(0)">Encore</button>
                <button class="grade-btn grade-hard" onclick="submitReviewGrade(1)">Difficile</button>
                <button class="grade-btn grade-good" onclick="submitReviewGrade(2)">Bien</button>
                <button class="grade-btn grade-easy" onclick="submitReviewGrade(3)">Facile</button>
            </div>
        ` : ''}
    `;
}

// ── QCM (reconnaissance du sens) ──
function renderQcmExercise(entry, session) {
    const { word, qcmInfo } = entry;
    const answered = session.answered;
    const selected = session.selected;
    
    return `
        <div class="review-card review-qcm-card">
            <div class="review-word">${word.word || ''}</div>
            <div class="review-reading">${word.reading || ''}</div>
            <div class="review-quiz-instruction">Quel est le sens de ce mot ?</div>
        </div>
        <div class="review-options">
            ${qcmInfo.options.map(opt => {
                let cls = 'review-option-btn';
                if (answered) {
                    if (opt === qcmInfo.correct) cls += ' correct';
                    else if (opt === selected) cls += ' incorrect';
                }
                return `<button class="${cls}" ${answered ? 'disabled' : ''} onclick="submitQuizAnswer('${opt.replace(/'/g, "\\'")}')">${mdBold(opt)}</button>`;
            }).join('')}
        </div>
        ${answered ? `<button class="review-continue-btn" onclick="advanceReviewQueue()">Continuer →</button>` : ''}
    `;
}

// ── CLOZE (trou à combler sur une particule) ──
function renderClozeExercise(entry, session) {
    const { word, clozeInfo } = entry;
    const answered = session.answered;
    const selected = session.selected;
    
    const sentenceHtml = clozeInfo.tokens.map((tok, i) => {
        if (i !== clozeInfo.blankIndex) return `<span>${tok}</span>`;
        if (!answered) return `<span class="cloze-blank">＿＿</span>`;
        const cls = selected === clozeInfo.correct ? 'cloze-blank-filled correct' : 'cloze-blank-filled incorrect';
        return `<span class="${cls}">${selected}</span>`;
    }).join(' ');
    
    return `
        <div class="review-card review-cloze-card">
            <div class="review-quiz-instruction">Complète la phrase avec la bonne particule</div>
            <div class="cloze-sentence">${sentenceHtml}</div>
            <div class="review-romaji">${word.romaji || ''}</div>
            <div class="review-example-fr-only">${mdBold((word.example && word.example.french) || '')}</div>
        </div>
        <div class="review-options review-options-particles">
            ${clozeInfo.options.map(opt => {
                let cls = 'review-option-btn';
                if (answered) {
                    if (opt === clozeInfo.correct) cls += ' correct';
                    else if (opt === selected) cls += ' incorrect';
                }
                return `<button class="${cls}" ${answered ? 'disabled' : ''} onclick="submitQuizAnswer('${opt}')">${opt}</button>`;
            }).join('')}
        </div>
        ${(answered && selected !== clozeInfo.correct) ? (
            entry.relatedGrammarEntry
                ? `<button class="fiche-correction-btn" style="margin-top:14px" onclick="showFicheCorrectionModal(reviewSession.queue[reviewSession.index].relatedGrammarEntry)">📖 Voir la leçon : ${clozeInfo.correct}</button>`
                : (entry.relatedGrammarEntry === null && word.nuance)
                    ? `<div class="vocab-nuance-box" style="margin-top:14px;text-align:left">💡 ${mdBold(word.nuance)}</div>`
                    : ''
        ) : ''}
        ${answered ? `<button class="review-continue-btn" onclick="advanceReviewQueue()">Continuer →</button>` : ''}
    `;
}

function flipReviewCard() {
    if (!reviewSession) return;
    reviewSession.flipped = true;
    renderReviewScreen();
}

// Réponse à un QCM ou un cloze : note automatiquement selon la justesse
// Cherche une leçon de grammaire dont "item" correspond exactement à la particule/notion donnée
// (une particule a généralement sa propre leçon dédiée dans grammar.json). Utilisé pour lier le
// quiz à trous du vocabulaire à la vraie fiche grammaire, plutôt qu'à la simple nuance du mot.
// Résultat mis en cache implicitement via getLevelGrammarData (déjà caché par niveau).
async function findGrammarLessonForItem(itemText) {
    if (!itemText) return null;
    for (const level of ALL_JLPT_LEVELS) {
        const gd = await getLevelGrammarData(level);
        if (gd && gd.data) {
            const found = gd.data.find(l => l.item === itemText);
            if (found) return { type: 'grammar', level, item: found };
        }
    }
    return null;
}

async function submitQuizAnswer(selected) {
    if (!reviewSession || reviewSession.answered) return;
    const session = reviewSession;
    const entry = session.queue[session.index];
    const correct = entry.type === 'cloze' ? entry.clozeInfo.correct : entry.qcmInfo.correct;
    const isCorrect = selected === correct;
    
    session.answered = true;
    session.selected = selected;
    
    const quality = isCorrect ? 2 : 0; // Bien si juste, Encore si faux
    gradeReview(entry.word.id, quality, { type: 'vocab', label: entry.word.word });
    if (!isCorrect) scheduleRelearning(session, entry);
    const labels = ['again', 'hard', 'good', 'easy'];
    session.results[labels[quality]]++;
    
    renderReviewScreen(); // affichage immédiat (couleurs correct/incorrect), sans attendre la recherche ci-dessous

    // Cloze raté : recherche (async, mise en cache par niveau) de la leçon grammaire liée à la
    // bonne particule, pour proposer "Voir la leçon" plutôt que la simple nuance du mot.
    if (entry.type === 'cloze' && !isCorrect && entry.relatedGrammarEntry === undefined) {
        const found = await findGrammarLessonForItem(entry.clozeInfo.correct);
        entry.relatedGrammarEntry = found || null;
        // Re-render seulement si on est toujours sur la même question (l'utilisateur n'a pas
        // déjà cliqué "Continuer" pendant la recherche)
        if (reviewSession === session && session.queue[session.index] === entry) {
            renderReviewScreen();
        }
    }
}

function advanceReviewQueue() {
    if (!reviewSession) return;
    reviewSession.index++;
    reviewSession.flipped = false;
    reviewSession.answered = false;
    reviewSession.selected = null;
    renderReviewScreen();
}

function submitReviewGrade(quality) {
    if (!reviewSession) return;
    const entry = reviewSession.queue[reviewSession.index];
    gradeReview(entry.word.id, quality, { type: 'vocab', label: entry.word.word });
    if (quality === 0) scheduleRelearning(reviewSession, entry);
    
    const labels = ['again', 'hard', 'good', 'easy'];
    reviewSession.results[labels[quality]]++;
    
    advanceReviewQueue();
}

function renderReviewSummary() {
    recordSessionCompleted();
    const container = document.getElementById('category-content');
    const r = reviewSession.results;
    const total = reviewSession.queue.length;
    
    container.innerHTML = `<div class="review-summary">
        <div class="review-summary-title">Session terminée ! 🎉</div>
        <div class="review-summary-count">${total} carte${total > 1 ? 's' : ''} révisée${total > 1 ? 's' : ''}</div>
        <div class="review-summary-stats">
            <div class="review-stat"><span class="review-stat-dot again"></span>Encore : ${r.again}</div>
            <div class="review-stat"><span class="review-stat-dot hard"></span>Difficile : ${r.hard}</div>
            <div class="review-stat"><span class="review-stat-dot good"></span>Bien : ${r.good}</div>
            <div class="review-stat"><span class="review-stat-dot easy"></span>Facile : ${r.easy}</div>
        </div>
        <button class="revise-btn" style="margin-top:20px;" onclick="history.back()">Retour au vocabulaire</button>
    </div>`;
    reviewSession = null;
}

/* ══════════════════════════════════════════════════
   ÉCRAN DE RÉVISION GRAMMAIRE (flashcard + SRS, réutilise le même moteur générique)
══════════════════════════════════════════════════ */
let grammarReviewSession = null; // { queue: [{lesson,type,clozeInfo}], index, results, flipped, answered, selected }

// Génère un trou à combler grammaire : utilise example.highlight (déjà la forme exacte présente dans la phrase)
function buildGrammarCloze(lesson, pool) {
    const example = Array.isArray(lesson.examples)
        ? lesson.examples.find(ex => ex.japanese && ex.highlight && ex.japanese.includes(ex.highlight))
        : null;
    if (!example) return null;
    
    const correct = example.highlight;
    const sentence = example.japanese;
    const blankStart = sentence.indexOf(correct);
    if (blankStart === -1) return null;
    
    // Distracteurs : le highlight d'autres leçons du pool
    const otherHighlights = pool
        .filter(l => l.id !== lesson.id)
        .map(l => {
            const ex = Array.isArray(l.examples) ? l.examples.find(e => e.highlight) : null;
            return ex ? ex.highlight : null;
        })
        .filter(h => h && h !== correct);
    
    const uniqueDistractors = [...new Set(otherHighlights)];
    if (uniqueDistractors.length < 3) return null;
    
    const distractors = shuffleArray(uniqueDistractors).slice(0, 3);
    const options = shuffleArray([correct, ...distractors]);
    
    return {
        before: sentence.slice(0, blankStart),
        after: sentence.slice(blankStart + correct.length),
        correct,
        french: example.french || '',
        options
    };
}

function prepareGrammarSessionItem(lesson, pool, forceMode = null) {
    const clozeInfo = buildGrammarCloze(lesson, pool);
    let type;
    if (forceMode === 'flashcard') type = 'flashcard';
    else if (forceMode === 'quiz') type = clozeInfo ? 'cloze' : 'flashcard'; // repli si pas de cloze possible
    else type = clozeInfo && Math.random() < 0.5 ? 'cloze' : 'flashcard';
    return { lesson, type, clozeInfo };
}

function showGrammarReviewModeSelector() {
    const container = document.getElementById('category-content');
    const data = grammarHomeData?.data || [];
    const dueLessons = buildDueQueue(data);

    if (dueLessons.length === 0) {
        alert('Rien à réviser pour le moment ! 🎉');
        return;
    }

    pushModalState('grammar-review-selector');

    container.innerHTML = `
        <div class="review-mode-selector">
            <button class="back-btn" onclick="history.back()">←</button>
            <div class="review-mode-title">Choisis ton mode de révision</div>
            <div class="review-mode-count">${dueLessons.length} leçon${dueLessons.length > 1 ? 's' : ''} à revoir</div>

            <button class="review-mode-btn" onclick="startGrammarReview()">
                <span class="review-mode-icon">🎲</span>
                <div><div class="review-mode-name">Mixte</div><div class="review-mode-desc">Flashcard et trous mélangés</div></div>
            </button>
            <button class="review-mode-btn" onclick="startGrammarReview('flashcard')">
                <span class="review-mode-icon">🗂️</span>
                <div><div class="review-mode-name">Flashcard</div><div class="review-mode-desc">Cours et exemples, auto-évalué</div></div>
            </button>
            <button class="review-mode-btn" onclick="startGrammarReview('quiz')">
                <span class="review-mode-icon">✍️</span>
                <div><div class="review-mode-name">Quiz actif</div><div class="review-mode-desc">Trous uniquement</div></div>
            </button>
            <button class="review-mode-btn" onclick="showFreeTrainingConfig(false, {type:'grammar', level: grammarHomeData?.levelId})">
                <span class="review-mode-icon">🏋️</span>
                <div><div class="review-mode-name">Entraînement libre</div><div class="review-mode-desc">Configurable, sans impact sur le SRS</div></div>
            </button>
        </div>`;
}

function startGrammarReview(forceMode = null) {
    const data = grammarHomeData?.data || [];
    const dueLessons = buildDueQueue(data);
    
    if (dueLessons.length === 0) {
        alert('Rien à réviser pour le moment ! 🎉');
        return;
    }
    
    const queue = dueLessons.map(l => prepareGrammarSessionItem(l, data, forceMode));
    
    pushModalState('grammar-review');
    
    grammarReviewSession = {
        queue,
        index: 0,
        results: { again: 0, hard: 0, good: 0, easy: 0 },
        flipped: false,
        answered: false,
        selected: null
    };
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    renderGrammarReviewScreen();
}

function renderGrammarReviewScreen() {
    const container = document.getElementById('category-content');
    const session = grammarReviewSession;
    
    if (!session || session.index >= session.queue.length) {
        renderGrammarReviewSummary();
        return;
    }
    
    const entry = session.queue[session.index];
    const progress = session.index + 1;
    const total = session.queue.length;
    
    const bodyHtml = entry.type === 'cloze'
        ? renderGrammarClozeExercise(entry, session)
        : renderGrammarFlashcardExercise(entry, session);
    
    container.innerHTML = `<div class="review-page">
        <div class="review-header">
            <button class="back-btn" onclick="history.back()">✕</button>
            <div class="review-progress-bar"><div class="review-progress-fill" style="width:${(session.index / total) * 100}%"></div></div>
            <div class="review-progress-text">${progress} / ${total}</div>
        </div>
        ${bodyHtml}
    </div>`;
}

function renderGrammarFlashcardExercise(entry, session) {
    const lesson = entry.lesson;
    const itemText = lesson.item || lesson.pattern || 'Formule';
    const titleText = lesson.title || lesson.meaning || 'Sans titre';
    const flipped = session.flipped;
    const firstExample = Array.isArray(lesson.examples) && lesson.examples.length > 0 ? lesson.examples[0] : null;
    
    return `
        <div class="review-card ${flipped ? 'flipped' : ''}" onclick="${flipped ? '' : 'flipGrammarReviewCard()'}">
            <div class="review-card-front">
                <div class="review-word" style="font-size:2rem;">${itemText}</div>
                ${flipped ? `<div class="review-reading">${titleText}</div>` : ''}
            </div>
            ${flipped ? `
                <div class="review-card-back">
                    <div class="review-romaji">${lesson.pattern || ''}</div>
                    ${firstExample ? `
                        <div class="review-example">
                            <div class="example-jp">${mdBold(firstExample.japanese || '')}</div>
                            <div class="example-fr">${mdBold(firstExample.french || '')}</div>
                        </div>
                    ` : ''}
                </div>
            ` : `<div class="review-tap-hint">Touche la carte pour révéler</div>`}
        </div>
        ${flipped ? `
            <div class="review-grade-buttons">
                <button class="grade-btn grade-again" onclick="submitGrammarReviewGrade(0)">Encore</button>
                <button class="grade-btn grade-hard" onclick="submitGrammarReviewGrade(1)">Difficile</button>
                <button class="grade-btn grade-good" onclick="submitGrammarReviewGrade(2)">Bien</button>
                <button class="grade-btn grade-easy" onclick="submitGrammarReviewGrade(3)">Facile</button>
            </div>
        ` : ''}
    `;
}

function renderGrammarClozeExercise(entry, session) {
    const { clozeInfo, lesson } = entry;
    const answered = session.answered;
    const selected = session.selected;
    
    const blankHtml = !answered
        ? `<span class="cloze-blank">＿＿＿</span>`
        : `<span class="cloze-blank-filled ${selected === clozeInfo.correct ? 'correct' : 'incorrect'}">${selected}</span>`;

    // Affiche les confusions documentées sur la leçon dès qu'une réponse est fausse — le champ
    // "with" contient en pratique des descriptions riches (ex: "Particule d'assurance よ"), pas
    // forcément le texte exact de la mauvaise réponse cliquée. On tente d'abord une correspondance
    // exacte (utile si un jour une entrée est écrite sous forme courte), sinon on affiche la
    // première confusion documentée : c'est un point de vigilance pertinent pour la leçon dans
    // tous les cas, peu importe laquelle des options a été cliquée par erreur.
    const isWrong = answered && selected !== clozeInfo.correct;
    let confusion = null;
    if (isWrong && Array.isArray(lesson.confusions) && lesson.confusions.length) {
        confusion = lesson.confusions.find(c => c.with === selected) || lesson.confusions[0];
    }
    
    return `
        <div class="review-card review-cloze-card">
            <div class="review-quiz-instruction">Complète la phrase avec le bon élément grammatical</div>
            <div class="cloze-sentence">${clozeInfo.before}${blankHtml}${clozeInfo.after}</div>
            <div class="review-example-fr-only">${mdBold(clozeInfo.french)}</div>
        </div>
        <div class="review-options">
            ${clozeInfo.options.map(opt => {
                let cls = 'review-option-btn';
                if (answered) {
                    if (opt === clozeInfo.correct) cls += ' correct';
                    else if (opt === selected) cls += ' incorrect';
                }
                return `<button class="${cls}" ${answered ? 'disabled' : ''} onclick="submitGrammarQuizAnswer('${opt.replace(/'/g, "\\'")}')">${opt}</button>`;
            }).join('')}
        </div>
        ${isWrong ? buildWrongParticleMessageHtml(selected) : ''}
        ${confusion ? buildConfusionBoxHtml(confusion) : ''}
        ${answered ? `<button class="review-continue-btn" onclick="advanceGrammarReviewQueue()">Continuer →</button>` : ''}
    `;
}

// Contenu de l'encadré "pourquoi c'est faux" — repose entièrement sur le champ optionnel
// confusions[] de grammar.json (voir modèle communiqué : { with, explanation, wrong_example? }).
// wrong_example est facultatif, on s'en passe proprement si absent. Le champ optionnel "voir"
// (id d'une autre leçon, ex: "n4_g_4") génère un badge cliquable "🔎 Voir aussi : Leçon X · item"
// à partir des vraies données de la leçon visée — jamais du texte écrit à la main, donc toujours
// juste même si la leçon visée est renommée plus tard.
function buildConfusionBoxHtml(confusion) {
    const voirLesson = confusion.voir ? findLessonByIdSync(confusion.voir) : null;
    if (confusion.voir && !voirLesson) {
        console.warn(`⚠️ "voir": "${confusion.voir}" introuvable — vérifie que cette leçon existe bien dans le grammar.json de son niveau.`);
    }
    return `
        <div class="confusion-box">
            <div class="confusion-box-title">💡 Point de vigilance : ${confusion.with}</div>
            ${voirLesson ? `
                <div class="lesson-voir-badge" onclick="event.stopPropagation();showLessonReferencePopup('${voirLesson.id}')">
                    🔎 Aperçu : Leçon ${voirLesson.lesson_number || '?'} · ${voirLesson.item || voirLesson.title}${getItemRomaji(voirLesson.item, voirLesson.item_romaji) ? ` · ${getItemRomaji(voirLesson.item, voirLesson.item_romaji)}` : ''}
                </div>
            ` : ''}
            <div class="confusion-box-text">${mdBold(confusion.explanation || '')}</div>
            ${confusion.wrong_example ? `
                <div class="confusion-example-row wrong"><span>✘</span><span>${mdBold(confusion.wrong_example.japanese || '')}</span></div>
                ${confusion.wrong_example.romaji ? `<div class="confusion-example-romaji">${confusion.wrong_example.romaji}</div>` : ''}
                <div class="confusion-example-row ok"><span>✔</span><span>${mdBold(confusion.wrong_example.correct_japanese || '')}</span></div>
                ${confusion.wrong_example.correct_romaji ? `<div class="confusion-example-romaji">${confusion.wrong_example.correct_romaji}</div>` : ''}
                ${confusion.wrong_example.french ? `<div class="confusion-example-fr">${mdBold(confusion.wrong_example.french)}</div>` : ''}
            ` : ''}
        </div>
    `;
}

function flipGrammarReviewCard() {
    if (!grammarReviewSession) return;
    grammarReviewSession.flipped = true;
    renderGrammarReviewScreen();
}

function submitGrammarQuizAnswer(selected) {
    if (!grammarReviewSession || grammarReviewSession.answered) return;
    const session = grammarReviewSession;
    const entry = session.queue[session.index];
    const isCorrect = selected === entry.clozeInfo.correct;
    
    session.answered = true;
    session.selected = selected;
    
    const quality = isCorrect ? 2 : 0;
    gradeReview(entry.lesson.id, quality, { type: 'grammar', label: entry.lesson.item || entry.lesson.pattern });
    if (!isCorrect) scheduleRelearning(session, entry);
    const labels = ['again', 'hard', 'good', 'easy'];
    session.results[labels[quality]]++;
    
    renderGrammarReviewScreen();
}

function advanceGrammarReviewQueue() {
    if (!grammarReviewSession) return;
    grammarReviewSession.index++;
    grammarReviewSession.flipped = false;
    grammarReviewSession.answered = false;
    grammarReviewSession.selected = null;
    renderGrammarReviewScreen();
}

function submitGrammarReviewGrade(quality) {
    if (!grammarReviewSession) return;
    const entry = grammarReviewSession.queue[grammarReviewSession.index];
    gradeReview(entry.lesson.id, quality, { type: 'grammar', label: entry.lesson.item || entry.lesson.pattern });
    if (quality === 0) scheduleRelearning(grammarReviewSession, entry);
    
    const labels = ['again', 'hard', 'good', 'easy'];
    grammarReviewSession.results[labels[quality]]++;
    
    advanceGrammarReviewQueue();
}

function renderGrammarReviewSummary() {
    recordSessionCompleted();
    const container = document.getElementById('category-content');
    const r = grammarReviewSession.results;
    const total = grammarReviewSession.queue.length;
    
    container.innerHTML = `<div class="review-summary">
        <div class="review-summary-title">Session terminée ! 🎉</div>
        <div class="review-summary-count">${total} leçon${total > 1 ? 's' : ''} révisée${total > 1 ? 's' : ''}</div>
        <div class="review-summary-stats">
            <div class="review-stat"><span class="review-stat-dot again"></span>Encore : ${r.again}</div>
            <div class="review-stat"><span class="review-stat-dot hard"></span>Difficile : ${r.hard}</div>
            <div class="review-stat"><span class="review-stat-dot good"></span>Bien : ${r.good}</div>
            <div class="review-stat"><span class="review-stat-dot easy"></span>Facile : ${r.easy}</div>
        </div>
        <button class="revise-btn" style="margin-top:20px;" onclick="history.back()">Retour à la grammaire</button>
    </div>`;
    grammarReviewSession = null;
}

function displayVocabList(levelId, data, examples = null, isBack = false) {
    const container = document.getElementById('category-content');
    if (!Array.isArray(data)) {
        container.innerHTML = '<div style="color:var(--gray)">Structure invalide</div>';
        return;
    }
    
    if (!isBack) history.pushState({ view: 'vocab-list' }, '');
    
    // Stocker les données
    vocabHomeData = {levelId, data, examples};
    currentLevelId = levelId;
    
    // Grouper par catégorie
    const grouped = {};
    data.forEach(word => {
        const cat = word.category || 'other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(word);
    });
    
    // Trier les catégories
    const sortedCats = Object.keys(grouped).sort();
    
    const dueCount = countDueItems(data);
    
    // Construire l'HTML avec boxes
    let html = `<div class="vocab-container">`;
    
    // Le bouton "Réviser" a été retiré d'ici : la révision de ce niveau se fait désormais
    // exclusivement via l'onglet "Réviser" (bottom-nav), qui propose en plus un choix de mode.
    html += `<div style="display:flex;gap:8px">
        ${!bulkSelectMode ? `<button class="bulk-select-toggle-btn" style="flex:1" onclick="enterBulkSelectMode(() => displayVocabList('${levelId}', vocabHomeData.data, vocabHomeData.examples, true))">☑ Sélectionner</button>` : ''}
    </div>`;
    
    html += sortedCats.map(cat => {
        const label = VOCAB_CATEGORY_MAP[cat] || `📌 ${cat}`;
        const words = grouped[cat];
        const catId = `vocab-cat-${cat}`;
        
        return `
            <div class="vocab-category-box">
                <div class="vocab-category-header" onclick="const content = document.getElementById('${catId}'); content.classList.toggle('open'); this.querySelector('.vocab-cat-arrow').classList.toggle('open')">
                    <div class="vocab-category-title">
                        ${bulkSelectMode ? `<input type="checkbox" class="bulk-cat-checkbox" onclick='event.stopPropagation(); toggleCategoryMasteryLive(this, ${JSON.stringify(words.map(w => w.id))})' ${words.every(w => getItemStatus(w.id) === 'mastered') ? 'checked' : ''}>` : ''}
                        <span class="vocab-cat-arrow">▶</span>
                        <span>${label}</span>
                    </div>
                    <div class="vocab-cat-counter">${words.length}</div>
                </div>
                
                <div class="vocab-category-content" id="${catId}">
                    ${words.map(word => {
                        const meaningText = (() => {
                            const m = word.meanings;
                            if (Array.isArray(m)) return m.join(' • ');
                            if (m && typeof m === 'object') return m.primary || '';
                            return m || '';
                        })();
                        const confidence = getSrsConfidencePct(word.id);
                        const isMastered = getItemStatus(word.id) === 'mastered';
                        return `
                        <div class="vocab-pill-card ${isBulkSelected(word.id) ? 'bulk-selected' : ''}" onclick="handleListItemClick(this, '${word.id}', () => showVocabDetail('${word.id}', vocabHomeData.data))" style="position:relative;">
                            ${isMastered ? '<span class="mastered-check">✔</span>' : ''}
                            <div class="vocab-pill-badge" style="--pct:${confidence === null ? 0 : confidence}">
                                <span>${confidence === null ? '–' : confidence}</span>
                            </div>
                            <div class="vocab-pill-left">
                                <div class="vocab-pill-word">${word.word || ''}</div>
                                <div class="vocab-pill-reading">${word.reading || ''}</div>
                            </div>
                            <div class="vocab-pill-right">
                                <div class="vocab-pill-meaning">${meaningText}</div>
                                <div class="vocab-pill-romaji">${word.romaji || ''}</div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');
    
    html += `</div>`;
    
    container.innerHTML = html;
}

function showVocabDetail(wordId, allWords = [], isBack = false) {
    // Retire l'ancien bandeau "Vocabulaire" (cat-header) qui restait affiché au-dessus : la fiche
    // a déjà sa propre en-tête complète (retour + progression) juste en dessous.
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    const container = document.getElementById('category-content');
    
    // Fallback si allWords est vide
    if (!allWords || allWords.length === 0) {
        allWords = vocabHomeData?.data || [];
    }
    
    const word = allWords.find(w => w.id === wordId);
    
    if (!word) {
        container.innerHTML = '<div style="color:var(--gray)">Mot non trouvé</div>';
        return;
    }
    
    if (!isBack) history.pushState({ view: 'vocab-detail', wordId }, '');
    
    const status = getItemStatus(word.id);
    const level = word.level || 'N5';
    const currentIndex = allWords.findIndex(w => w.id === wordId);
    const totalWords = allWords.length;
    
    // Normalise meanings : supporte l'ancien format (tableau de strings) ET le nouveau ({primary, secondary[]})
    const normalizeMeanings = () => {
        const m = word.meanings;
        if (Array.isArray(m)) return { primary: m[0] || 'Sens', secondary: m.slice(1) };
        if (m && typeof m === 'object') return { primary: m.primary || 'Sens', secondary: Array.isArray(m.secondary) ? m.secondary : [] };
        if (typeof m === 'string') return { primary: m, secondary: [] };
        return { primary: 'Sens', secondary: [] };
    };
    const { primary: primaryMeaning, secondary: secondaryMeanings } = normalizeMeanings();
    
    // Classification du type par mots-clés (robuste aux variations de formulation : "verb", "verbe godan", "nom"...)
    const classifyType = (typeRaw) => {
        if (!typeRaw) return null;
        const t = typeRaw.toLowerCase();
        if (t.includes('verb')) return { color: '#6EA8FF' };
        if (t.includes('nom') || t.includes('noun')) return { color: '#4ADE80' };
        if (t.includes('adj')) return { color: '#FBBF24' };
        if (t.includes('adv')) return { color: '#38BDF8' };
        if (t.includes('partic')) return { color: '#9D6EFF' };
        if (t.includes('interj') || t.includes('express')) return { color: '#FB7185' };
        return { color: '#A7B0C0' };
    };
    
    const buildTypeBadge = () => {
        if (!word.type) return '';
        const info = classifyType(word.type) || { color: '#A7B0C0' };
        const groupLabel = word.group ? ` · ${word.group}` : '';
        return `<span class="vocab-type-badge" style="background: ${info.color}22; color: ${info.color}; border: 1px solid ${info.color}66; box-shadow: 0 0 8px ${info.color}33;">${word.type}${groupLabel}</span>`;
    };
    
    let html = `<div class="vocab-detail-page">`;
    
    // HEADER
    html += `<div class="vocab-detail-header">
        <button class="back-btn" onclick="displayVocabList(currentLevelId, vocabHomeData.data, vocabHomeData.examples)">←</button>
        <div class="vocab-progress">${currentIndex + 1} / ${totalWords}</div>
    </div>`;
    
    // BADGE + FAVORIS
    html += `<div class="vocab-detail-top">
        <span class="vocab-level-badge">${level}</span>
        <button class="vocab-favorite-btn ${status === 'favorited' ? 'active' : ''}" onclick="trackItem('${word.id}', '${status === 'favorited' ? 'null' : 'favorited'}'); showVocabDetail('${word.id}', vocabHomeData.data)">
            ${status === 'favorited' ? '❤' : '🤍'}
        </button>
    </div>`;
    
    // WORD BOX
    html += `<div class="vocab-detail-main-box">
        <div class="vocab-reading">${word.reading || ''}</div>
        <div class="vocab-word">${word.word || ''}</div>
        <div class="vocab-romaji">${word.romaji || ''}</div>
        ${buildTypeBadge()}
        <button class="vocab-speak-btn" onclick="speakText('${(word.word || '').replace(/'/g, "\\'")}')" title="Écouter">🔊</button>
    </div>`;
    
    // MEANINGS — sens premier mis en avant, sens secondaires en dessous
    html += `<div class="vocab-section-title">Signification</div>`;
    html += `<div class="vocab-meanings">`;
    html += `<div class="vocab-meaning-primary">${mdBold(primaryMeaning)}</div>`;
    secondaryMeanings.forEach(m => {
        html += `<div class="vocab-meaning-secondary">${mdBold(m)}</div>`;
    });
    html += `</div>`;
    
    // NUANCE (si présente dans le JSON)
    if (word.nuance) {
        html += `<div class="vocab-nuance-box">💡 ${mdBold(word.nuance)}</div>`;
    }
    
    // EXEMPLE
    if (word.example && word.example.japanese) {
        html += `<div class="vocab-section-title">Exemple en contexte</div>`;
        html += `<div class="vocab-example-box">
            <div class="example-jp">${mdBold(word.example.japanese || '')}</div>
            <div class="example-ro">${mdBold(word.example.romaji || '')}</div>
            <div class="example-fr">${mdBold(word.example.french || '')}</div>
            <button class="vocab-speak-btn-example" onclick="speakText('${(word.example.japanese || '').replace(/'/g, "\\'")}')" title="Écouter">🔊</button>
        </div>`;
    }
    
    // KANJI DE CE MOT (kanji_list) — cliquables, ouvrent la fiche kanji en superposition
    if (Array.isArray(word.kanji_list) && word.kanji_list.length) {
        const chips = word.kanji_list
            .map(char => {
                const k = kanjiDb.find(kd => kd.char === char);
                if (!k) return '';
                const meaning = (k.meanings || []).find(m => !m.toLowerCase().includes('radical')) || k.meanings?.[0] || '';
                return `<div class="vocab-kanji-chip" onclick="openDetail({char:'${char}'})">
                    <span class="vocab-kanji-chip-char">${char}</span>
                    <span class="vocab-kanji-chip-meaning">${meaning}</span>
                </div>`;
            })
            .join('');
        if (chips) {
            html += `<div class="vocab-section-title">Kanji de ce mot</div>`;
            html += `<div class="vocab-kanji-chips">${chips}</div>`;
        }
    }
    
    // BOUTON MAÎTRISE
    html += `<div class="vocab-detail-actions">
        <button class="vocab-master-btn ${status === 'mastered' ? 'active' : ''}" onclick="trackItem('${word.id}', '${status === 'mastered' ? 'null' : 'mastered'}'); showVocabDetail('${word.id}', vocabHomeData.data)">
            ${status === 'mastered' ? '✓ Maîtrisé' : '✓ Marquer comme maîtrisé'}
        </button>
    </div>`;
    
    html += `</div>`;
    
    container.innerHTML = html;
}


// Mapping intelligent : détection de famille par mots-clés
// Convertit le markdown **gras** en <span> stylé (gras + couleur ambre) — utilisée par Grammaire ET Vocabulaire
function mdBold(text) {
    if (!text) return text || '';
    // Gras : **texte** — traité en premier pour ne pas être cassé par la règle italique
    let result = text.replace(/\*\*(.+?)\*\*/g, '<span class="md-bold">$1</span>');
    // Italique : *texte* (astérisque simple, convention markdown standard)
    result = result.replace(/\*(.+?)\*/g, '<em class="md-italic">$1</em>');
    return result;
}

// Petit graphique décoratif en vagues avec point lumineux en bout, coloré selon le niveau
function buildNiveauxWaveSvg(color) {
    return `<svg class="niveaux-wave" viewBox="0 0 160 32" preserveAspectRatio="none">
        <path d="M0,24 Q20,8 40,20 T80,10 T120,18 T158,14" fill="none" stroke="${color}" stroke-width="2" opacity="0.55"/>
        <circle cx="158" cy="14" r="3.5" fill="${color}" style="filter:drop-shadow(0 0 6px ${color})"/>
    </svg>`;
}

function getFamilyColor(badgeText) {
    const text = (badgeText || '').toLowerCase();
    
    // Structure : Existence, Démonstratif, Déterminant, Interrogatif, Indéfini, Lieu spatial
    if (text.match(/copule|existence|démonstratif|déterminant|lieu|spatial/i)) {
        return { color: '#4ADE80', emoji: '🟢', family: 'Structure' };
    }
    
    // Verbes & Actions
    if (text.match(/verbe|désir|volonté|requête|obligation|capacité|passe-temps|expérience|action|proposition|invitation/i)) {
        return { color: '#6EA8FF', emoji: '🔵', family: 'Verbes & Actions' };
    }
    
    // Temps & Chronologie
    if (text.match(/passé|progressif|chronologie|séquence|conditionnel|temporel|temps/i)) {
        return { color: '#9D6EFF', emoji: '🟣', family: 'Temps' };
    }
    
    // Relations & Logique
    if (text.match(/cause|opposition|concession|simultanéité|citation|logique|raison/i)) {
        return { color: '#FBBF24', emoji: '🟠', family: 'Logique' };
    }
    
    // Modalités
    if (text.match(/permission|interdiction|changement|don|réception|service|facilité|excès|absence|aide|conseil/i)) {
        return { color: '#FB7185', emoji: '🟡', family: 'Modalités' };
    }
    
    // Interrogatif / Indéfini / Négatif
    if (text.match(/interrogatif|indéfini|négatif|question/i)) {
        return { color: '#4ADE80', emoji: '🟢', family: 'Structure' };
    }
    
    // Défaut
    return { color: '#A7B0C0', emoji: '⚪', family: 'Autre' };
}

function showGrammarHome(levelId, data, examples = null, isBack = false) {
    const container = document.getElementById('category-content');
    if (!Array.isArray(data)) {
        container.innerHTML = '<div style="color:var(--gray)">Structure invalide</div>';
        return;
    }
    
    if (!isBack) history.pushState({ view: 'grammar-home' }, '');
    
    grammarHomeData = {levelId, data, examples};
    
    // Grouper par unité
    const groupedByUnit = {};
    data.forEach(lesson => {
        const unitKey = lesson.unit || 'unknown';
        const unitTitle = lesson.unit_title || `Unité ${unitKey}`;
        
        if (!groupedByUnit[unitKey]) {
            groupedByUnit[unitKey] = {
                title: unitTitle,
                lessons: []
            };
        }
        groupedByUnit[unitKey].lessons.push(lesson);
    });
    
    // Trier par numéro d'unité
    const sortedUnits = Object.keys(groupedByUnit)
        .sort((a, b) => Number(a) - Number(b));
    
    const dueCount = countDueItems(data);
    
    let html = `<div class="grammar-container">`;
    
    // Le bouton "Réviser" a été retiré d'ici : la révision de ce niveau se fait désormais
    // exclusivement via l'onglet "Réviser" (bottom-nav), qui propose en plus un choix de mode.
    html += `<div style="display:flex;gap:8px">
        ${!bulkSelectMode ? `<button class="bulk-select-toggle-btn" style="flex:1" onclick="enterBulkSelectMode(() => showGrammarHome('${levelId}', grammarHomeData.data, grammarHomeData.examples, true))">☑ Sélectionner</button>` : ''}
    </div>`;
    
    html += sortedUnits.map((unitKey, unitIdx) => {
        const unit = groupedByUnit[unitKey];
        const tracking = getTracking();
        const unitMastered = unit.lessons.filter(l => tracking[l.id]?.status === 'mastered').length;
        const unitId = `unit-${unitKey}`;
        const lessonNumber = String(unitIdx + 1).padStart(1, '0');
        
        return `
            <div class="unit-box-wrapper">
                <div class="unit-box-header">
                    <div class="unit-box-title">
                        ${bulkSelectMode ? `<input type="checkbox" class="bulk-cat-checkbox" onclick='event.stopPropagation(); toggleCategoryMasteryLive(this, ${JSON.stringify(unit.lessons.map(l => l.id))})' ${unit.lessons.every(l => getItemStatus(l.id) === 'mastered') ? 'checked' : ''}>` : ''}
                        <span class="unit-box-arrow">▶</span>
                        <span>${lessonNumber} - ${unit.title.toUpperCase()}</span>
                    </div>
                    <div class="unit-box-counter">${unitMastered}/${unit.lessons.length}</div>
                </div>
                
                <div class="unit-box-content" id="${unitId}">
                    ${unit.lessons.map((lesson, cardIdx) => {
                        const status = getItemStatus(lesson.id);
                        const badgeText = lesson.badge || 'Leçon';
                        const itemText = lesson.item || lesson.pattern || 'Formule';
                        const titleText = lesson.title || lesson.meaning || 'Sans titre';
                        const badgeStyle = getFamilyColor(badgeText);
                        
                        return `
                            <div class="lesson-card-in-box ${isBulkSelected(lesson.id) ? 'bulk-selected' : ''}" onclick="handleListItemClick(this, '${lesson.id}', () => showGrammarDetail('${lesson.id}'))">
                                <div class="card-header-in-box">
                                    <span class="lesson-badge-in-box" style="background: ${badgeStyle.color}22; color: ${badgeStyle.color}; border: 1px solid ${badgeStyle.color}66; box-shadow: 0 0 8px ${badgeStyle.color}33;">
                                        ${badgeStyle.emoji} ${badgeText}
                                    </span>
                                    ${status === 'favorited' ? '<span class="status-icon-in-box favorited">❤</span>' : ''}
                                </div>
                                ${status === 'mastered' ? '<span class="mastered-check">✔</span>' : ''}
                                <div class="card-item-in-box">${itemText}</div>
                                <div class="card-title-in-box">${titleText}</div>
                                ${(() => {
                                    const firstSection = lesson.sections && lesson.sections[0];
                                    if (!firstSection) return '';
                                    const raw = firstSection.text || (Array.isArray(firstSection.paragraphs) ? firstSection.paragraphs[0] : '') || '';
                                    const plain = raw.replace(/<[^>]*>/g, ''); // retire le HTML inline (ex: inline-highlight)
                                    if (!plain) return '';
                                    return `<div class="card-description-in-box">${plain.substring(0, 50)}...</div>`;
                                })()}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');
    
    html += `</div>`;
    
    container.innerHTML = html;
    
    // Ajouter les event listeners pour les flèches
    document.querySelectorAll('.unit-box-header').forEach(header => {
        header.addEventListener('click', function() {
            const arrow = this.querySelector('.unit-box-arrow');
            const content = this.nextElementSibling;
            arrow.classList.toggle('open');
            content.classList.toggle('open');
        });
    });
}

// Rendu du corps d'une section de leçon grammaire : supporte tous les formats rencontrés
// (ancien : text simple ; nouveau : paragraphs[] ; sous-titre+liste unique ; blocks[] pour
// plusieurs sous-titres+listes distincts dans une même section, ex "Groupe 1"/"Groupe 2").
// Fonction globale partagée entre la vraie fiche détail (showGrammarDetail) et la modale
// "voir la fiche" pendant les révisions (buildFicheDetailContent) — un seul endroit à mettre
// à jour si un nouveau format de section apparaît.
function renderSectionBody(section) {
    let body = '';

    if (section.text) {
        body += `<div class="section-paragraph">${mdBold(section.text)}</div>`;
    }

    if (Array.isArray(section.paragraphs)) {
        body += section.paragraphs.map(p => `<div class="section-paragraph">${mdBold(p)}</div>`).join('');
    }

    if (section.sub_title) {
        body += `<div class="section-sub-title">${mdBold(section.sub_title)}</div>`;
    }

    if (Array.isArray(section.list)) {
        body += `<ul class="section-list">${section.list.map(item => `<li>${mdBold(item)}</li>`).join('')}</ul>`;
    }

    if (Array.isArray(section.blocks)) {
        body += section.blocks.map(block => {
            let blockHtml = '';
            if (block.sub_title) {
                blockHtml += `<div class="section-sub-title">${mdBold(block.sub_title)}</div>`;
            }
            if (Array.isArray(block.paragraphs)) {
                blockHtml += block.paragraphs.map(p => `<div class="section-paragraph">${mdBold(p)}</div>`).join('');
            }
            if (Array.isArray(block.list)) {
                blockHtml += `<ul class="section-list">${block.list.map(item => `<li>${mdBold(item)}</li>`).join('')}</ul>`;
            }
            return blockHtml;
        }).join('');
    }

    return body;
}

function showGrammarDetail(lessonId, isBack = false) {
    const {levelId, data} = grammarHomeData || {};
    // Retire l'ancien bandeau "Grammaire" (cat-header) qui restait affiché au-dessus : la fiche
    // a déjà sa propre en-tête complète (retour + niveau/unité) juste en dessous.
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    const container = document.getElementById('category-content');
    const lesson = data.find(l => l.id === lessonId);
    
    if (!lesson) {
        container.innerHTML = '<div style="color:var(--gray)">Leçon non trouvée</div>';
        return;
    }
    
    if (!isBack) history.pushState({ view: 'grammar-detail', lessonId }, '');
    
    const status = getItemStatus(lesson.id);
    const itemText = lesson.item || lesson.pattern || 'Formule';
    const titleText = lesson.title || lesson.meaning || 'Sans titre';
    const patternText = lesson.pattern || itemText;
    const lessonNum = lesson.lesson_number ? String(lesson.lesson_number).padStart(2, '0') : '01';
    const unitText = lesson.unit_title || `Unité ${lesson.unit}`;
    const badgeText = lesson.badge || 'Leçon';
    const levelLabel = lesson.level || (levelId ? levelId.toUpperCase() : 'N5');
    
    // Fonction helper pour surligner
    const highlightText = (text, highlight) => {
        if (!text || !highlight) return text || '';
        return text.replace(
            new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g'),
            '<span class="highlight-grammar">$1</span>'
        );
    };
    
    // mdBold et renderSectionBody sont maintenant des fonctions globales (voir plus haut dans le fichier)
    
    // Résout les exemples d'une leçon : priorité aux exemples externes (exemples.json, format N4+),
    // fallback sur lesson.examples embarqué (format N5). Déduit le highlight si absent.
    const resolveExamples = () => {
        const externalMap = grammarHomeData?.examples?.grammar;
        if (externalMap) {
            const prefix = `${lesson.id}_ex`;
            const matchedKeys = Object.keys(externalMap)
                .filter(k => k.startsWith(prefix))
                .sort((a, b) => (parseInt(a.slice(prefix.length)) || 0) - (parseInt(b.slice(prefix.length)) || 0));
            
            if (matchedKeys.length > 0) {
                const baseItem = (lesson.item || '').replace(/^〜/, '').split(/[\s/]/)[0];
                return matchedKeys.map(k => {
                    const ex = externalMap[k];
                    const japanese = ex.jp || '';
                    const highlight = baseItem && japanese.includes(baseItem) ? baseItem : '';
                    return {
                        japanese,
                        romaji: ex.ro || '',
                        french: ex.fr || '',
                        highlight
                    };
                });
            }
        }
        return Array.isArray(lesson.examples) ? lesson.examples : [];
    };
    const resolvedExamples = resolveExamples();
    
    let html = `<div class="detail-page">
        <!-- HEADER -->
        <div class="detail-header-top">
            <button onclick="showGrammarHome(grammarHomeData.levelId, grammarHomeData.data, grammarHomeData.examples)" class="back-btn">←</button>
            <div class="header-info">
                <div class="lesson-title">Leçon ${lessonNum}</div>
                <div class="lesson-subtitle">${levelLabel} • ${unitText}</div>
            </div>
        </div>
        
        <!-- POINT DE GRAMMAIRE -->
        <div class="grammar-point-box">
            <div class="section-label">POINT DE GRAMMAIRE</div>
            <div class="item-display">${itemText}</div>
            ${getItemRomaji(itemText, lesson.item_romaji) ? `<div class="item-romaji">${getItemRomaji(itemText, lesson.item_romaji)}</div>` : ''}
            <div class="item-description">${titleText}</div>
            <div class="pattern-box">${highlightText(patternText, itemText)}</div>
        </div>
        
        <!-- BOUTONS ACTIONS -->
        <div class="action-buttons">
            <button class="link-btn" onclick="startSpecificGrammarLesson('${lesson.id}', '${levelId}')">Revoir le cours animé &nbsp;&nbsp;▶︎</button>
            <button class="revise-btn ${status === 'mastered' ? 'active' : ''}" onclick="trackItem('${lesson.id}', '${status === 'mastered' ? 'null' : 'mastered'}'); showGrammarDetail('${lesson.id}')">
                ${status === 'mastered' ? '✓ Maîtrisé' : '✓ Marquer comme maîtrisé'}
            </button>
        </div>
        
        <!-- SECTIONS -->
        ${lesson.sections && Array.isArray(lesson.sections) ? lesson.sections.map(section => `
            <div class="detail-section">
                <div class="section-label">${section.label || 'Section'}</div>
                <div class="section-content-box">
                    ${renderSectionBody(section)}
                </div>
            </div>
        `).join('') : ''}
        
        <!-- EXEMPLES -->
        ${resolvedExamples.length > 0 ? `
            <div class="examples-section">
                <div class="section-label">EXEMPLES</div>
                <div class="examples-container">
                    ${resolvedExamples.map(example => `
                        <div class="example-item">
                            <div class="example-jp">${highlightText(example.japanese || '', example.highlight || '')}</div>
                            <div class="example-ro">${example.romaji || ''}</div>
                            <div class="example-fr">${example.french || ''}</div>
                            ${example.japanese ? `<button class="speak-btn" onclick="speakText('${(example.japanese || '').replace(/'/g, "\\'")}')" title="Cliquer pour écouter">🔊</button>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
        
        <!-- POINTS DE VIGILANCE -->
        ${Array.isArray(lesson.confusions) && lesson.confusions.length ? `
            <div class="examples-section">
                <div class="section-label">POINTS DE VIGILANCE</div>
                ${lesson.confusions.map(c => buildConfusionBoxHtml(c)).join('')}
            </div>
        ` : ''}
        
        <!-- FAVORIS -->
        <div class="favorite-btn-section">
            <button class="favorite-btn ${status === 'favorited' ? 'active' : ''}" onclick="trackItem('${lesson.id}', '${status === 'favorited' ? 'null' : 'favorited'}'); showGrammarDetail('${lesson.id}')">
                ${status === 'favorited' ? '❤ Favorisé' : '🤍 Ajouter aux favoris'}
            </button>
        </div>
    </div>`;
    
    container.innerHTML = html;
}

function displayGrammarList(levelId, data, examples = null) {
    const container = document.getElementById('category-content');
    if (!Array.isArray(data)) {
        container.innerHTML = '<div style="color:var(--gray)">Structure invalide</div>';
        return;
    }
    
    // Grouper par type de grammaire
    const grouped = {};
    data.forEach(pattern => {
        const type = pattern.type || 'other';
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(pattern);
    });
    
    // Trier les types
    const sortedTypes = Object.keys(grouped).sort();
    
    // Construire l'HTML : afficher comme des leçons
    let html = '<div style="display:flex;flex-direction:column;gap:16px">';
    
    sortedTypes.forEach(type => {
        const label = GRAMMAR_TYPE_MAP[type] || type;
        const patterns = grouped[type];
        
        const patternCards = patterns.map((pattern, idx) => {
            // DEBUG
            if (idx === 0) console.log('Pattern 1:', pattern, 'Examples:', pattern.examples, 'Grammar DB:', examples?.grammar ? Object.keys(examples.grammar).length : 'none');
            
            // Charger les exemples réels pour ce pattern
            const patternExamples = examples && examples.grammar && pattern.examples
                ? pattern.examples.slice(0, 2).map(exId => examples.grammar[exId]).filter(ex => ex)
                : [];
            
            const exHTML = patternExamples.length > 0
                ? `<div data-examples style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
                    <div style="font-size:0.6875rem;color:var(--gray);margin-bottom:8px;font-weight:bold">Exemples :</div>
                    ${patternExamples.map(ex => `
                        <div style="font-size:0.6875rem;padding:8px;background:rgba(0,0,0,0.2);border-radius:4px;margin-bottom:6px;line-height:1.4">
                            <div style="color:#fff;font-size:0.75rem">${ex.jp}</div>
                            <div style="color:var(--accent);font-size:0.625rem;margin-top:3px">${ex.ro}</div>
                            <div style="color:var(--gray);font-size:0.6875rem;margin-top:3px">${ex.fr}</div>
                        </div>
                    `).join('')}
                </div>`
                : '<div data-examples style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:0.6875rem;color:var(--gray)">Pas d\'exemples disponibles</div>';
            
            return `
                <div style="padding:12px;background:rgba(255,255,255,0.08);border-left:3px solid #9b8bff;border-radius:6px;cursor:pointer;transition:all 0.15s;user-select:none" onclick="const ex = this.querySelector('[data-examples]'); ex.style.display = ex.style.display === 'none' ? 'block' : 'none'" onmouseover="this.style.background='rgba(255,255,255,0.12)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
                    <div style="font-size:0.875rem;font-weight:bold;color:var(--accent);margin-bottom:6px">${pattern.pattern}</div>
                    <div style="font-size:0.8125rem;color:#fff;line-height:1.4;margin-bottom:8px">${pattern.meaning}</div>
                    <div style="font-size:0.625rem;color:var(--gray);opacity:0.6">Cliquez pour voir les exemples →</div>
                    ${exHTML}
                </div>
            `;
        }).join('');
        
        html += `
            <div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--surface)">
                <div style="padding:12px;background:rgba(155,139,255,0.1);border-bottom:1px solid var(--border);cursor:pointer;user-select:none;" onclick="this.parentElement.querySelector('[data-lessons]').style.display = this.parentElement.querySelector('[data-lessons]').style.display === 'none' ? 'block' : 'none'; this.parentElement.querySelector('[data-arrow]').style.transform = this.parentElement.querySelector('[data-lessons]').style.display === 'none' ? 'rotate(0deg)' : 'rotate(90deg)'">
                    <div style="display:flex;align-items:center;gap:8px">
                        <span data-arrow style="display:inline-block;transition:transform 0.2s;transform:rotate(90deg)">▶</span>
                        <span style="font-size:0.8125rem;font-weight:bold">${label}</span>
                        <span style="font-size:0.6875rem;color:var(--gray);margin-left:auto">${patterns.length} leçons</span>
                    </div>
                </div>
                <div data-lessons style="padding:12px;display:flex;flex-direction:column;gap:8px">
                    ${patternCards}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

/* ══════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════ */
// Vue hebdomadaire façon Hibi : points reliés L-M-M-J-V-S-D, semaine courante (lundi→dimanche)
function buildWeekStreakHtml(streak) {
    const dayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    const now = new Date();
    const dow = now.getDay(); // 0=dimanche...6=samedi
    const mondayOffset = (dow === 0) ? 6 : dow - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - mondayOffset);

    const cells = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        cells.push({
            label: dayLabels[i],
            active: streak.activityDates.includes(dateStr),
            today: dateStr === todayStr()
        });
    }

    const dots = cells.map(c => `<div class="streak-week-dot${c.active ? ' active' : ''}${c.today ? ' today' : ''}">❀</div>`).join('');
    const labels = cells.map(c => `<span${c.today ? ' class="today"' : ''}>${c.label}</span>`).join('');

    return `<div class="streak-week-row">${dots}</div><div class="streak-week-labels">${labels}</div>`;
}

function showDashboard(isBack = false) {
    // Si ce n'est pas un retour arrière, on enregistre l'état
    if (!isBack) history.pushState({ view: 'dashboard' }, '');
    
    const streak = getStreakData();
    
    const hour = new Date().getHours();
    const greeting = hour < 5 ? 'Bonne nuit' : hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

    document.getElementById('main-content').innerHTML = `
        <div class="dash-wrap">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
                <img src="https://api.dicebear.com/7.x/bottts/svg?seed=tanuki" class="tanuki-img" alt="">
                <div style="font-size:0.8125rem;line-height:1.6;flex:1;">
                    ${greeting} ! <br>Prêt pour tes révisions ?
                </div>
            </div>
            <div class="dash-card dash-review-cta" id="dashboard-review-cta">
                <div style="color:var(--gray);font-size:0.75rem">Chargement des révisions…</div>
            </div>
            <div class="dash-card streak-week-card" onclick="showProgressionDetail()">
                <div class="streak-week-header">
                    <div class="streak-week-icon-box">続</div>
                    <div class="streak-week-title-block">
                        <div class="streak-week-label">Série en cours</div>
                        <div class="streak-week-num">${streak.currentStreak} jour${streak.currentStreak > 1 ? 's' : ''}</div>
                    </div>
                    <div class="streak-week-record">Record<br>${streak.bestStreak}j</div>
                </div>
                ${buildWeekStreakHtml(streak)}
            </div>
            <div class="dash-card weakness-widget" id="dashboard-weakness-widget" style="display:none;"></div>
            <div class="dash-card dash-mastery-card">
                <div class="section-title" style="font-size:0.6875rem;color:var(--text);text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;">Progression</div>
                <div id="progression-list"></div>
            </div>
        </div>`;
    // Appel de la fonction de progression si nécessaire ici
    if (typeof renderDashboard === 'function') renderDashboard();
    renderWeaknessWidget();
    renderDashboardReviewCta();
}

/* ══════════════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════════════ */
function navDashboard() {
    document.getElementById('page-title').innerText = '漢字 Study';
    showDashboard();
    renderDashboard();
    setActiveBottomNav('accueil');
}
function navKana() { loadKanas(); }
function navNiveaux() { showNiveauxScreen(); }

/* ══════════════════════════════════════════════════
   ÉCRAN "NIVEAUX" — cartes pleine largeur avec vraie progression
══════════════════════════════════════════════════ */
async function showNiveauxScreen(isBack = false) {
    if (!isBack) history.pushState({ view: 'niveaux' }, '');
    const mainContent = document.getElementById('main-content');
    document.getElementById('page-title').innerText = 'Niveaux';
    
    if (!jlptMapping) {
        mainContent.innerHTML = '<div style="padding:20px;color:var(--gray)">Chargement des niveaux…</div>';
        return;
    }
    
    mainContent.innerHTML = `
        <div class="niveaux-wrap">
            <div class="niveaux-header">
                <div class="niveaux-title-main">Niveaux</div>
                <div class="niveaux-subtitle-main">Ton vocabulaire par niveau JLPT.</div>
            </div>
            <div id="niveaux-list">
                <div style="padding:20px;text-align:center;color:var(--gray)"><div class="spinner"></div></div>
            </div>
        </div>`;
    
    const listEl = document.getElementById('niveaux-list');
    const sortedLevels = Object.entries(jlptMapping.levels).sort((a, b) => a[1].order - b[1].order);
    
    const cardsHtml = await Promise.all(sortedLevels.map(async ([levelId, levelData]) => {
        const vg = await getLevelVocabGrammarStats(levelId);
        const hasData = vg.vocabTotal > 0;
        const pct = hasData ? Math.round((vg.vocabMastered / vg.vocabTotal) * 100) : 0;
        
        if (!hasData) {
            return `
                <div class="niveaux-card locked">
                    <div class="niveaux-badge" style="background:${levelData.color}22;color:${levelData.color};border:1px solid ${levelData.color}44">${levelData.label}</div>
                    <div class="niveaux-info">
                        <div class="niveaux-card-title">${levelData.label_full}</div>
                        <div class="niveaux-card-sub">${levelData.description}</div>
                    </div>
                    <div class="niveaux-soon">Bientôt</div>
                </div>`;
        }
        
        return `
            <div class="niveaux-card" style="border-color:${levelData.color}99; box-shadow:0 0 18px ${levelData.color}59; background:${levelData.color}1f;" onclick="showCategoryDirect('${levelId}','vocab')">
                <div class="niveaux-badge" style="background:${levelData.color}22;color:${levelData.color};border:1px solid ${levelData.color}44">${levelData.label}</div>
                <div class="niveaux-info">
                    <div class="niveaux-card-title">${levelData.label_full}</div>
                    <div class="niveaux-card-sub">${vg.vocabMastered} / ${vg.vocabTotal} mots</div>
                    <div class="niveaux-progress-bar"><div class="niveaux-progress-fill" style="width:${pct}%;background:${levelData.color}"></div></div>
                    ${buildNiveauxWaveSvg(levelData.color)}
                </div>
                <div class="niveaux-pct">${pct}%</div>
            </div>`;
    }));
    
    listEl.innerHTML = cardsHtml.join('');
}

/* ══════════════════════════════════════════════════
   BARRE DE NAVIGATION EN BAS (façon Hibi)
══════════════════════════════════════════════════ */
function setActiveBottomNav(key) {
    ['accueil', 'recherche', 'apprendre', 'revisions'].forEach(k => {
        const btn = document.getElementById(`bnav-${k}`);
        if (btn) btn.classList.toggle('active', k === key);
    });
}

function bottomNavGo(target) {
    setActiveBottomNav(target);
    // Changer d'onglet ne doit jamais laisser une session/overlay actif en arrière-plan sur
    // le nouvel écran — la bottom-nav reste cliquable même par-dessus une session en cours.
    closeAllOverlaysAndSessions();
    if (target === 'accueil') {
        navDashboard();
    } else if (target === 'recherche') {
        toggleSearch();
    } else if (target === 'apprendre') {
        showApprendreScreen();
    } else if (target === 'revisions') {
        showRevisionsScreen();
    }
}

/* ══════════════════════════════════════════════════
   ÉCRAN "APPRENDRE" (façon Hibi) — hub vers Grammaire / Kanji / Kana + révision mixte
══════════════════════════════════════════════════ */
async function showApprendreScreen(isBack = false) {
    if (!isBack) history.pushState({ view: 'apprendre' }, '');
    document.getElementById('page-title').innerText = 'Apprendre';
    const main = document.getElementById('main-content');
    const savedLessonProgress = getSavedLessonProgress();
    const activeLevel = savedLessonProgress ? savedLessonProgress.level : await findActiveLearningLevel();
    const activeLevelLabel = activeLevel ? activeLevel.toUpperCase() : '';
    
    main.innerHTML = `
        <div class="apprendre-wrap">
            <div class="apprendre-header">
                <div class="apprendre-title-main">Apprendre</div>
                <div class="apprendre-subtitle-main">Suis le fil, ou choisis toi-même ci-dessous.</div>
            </div>
            
            <div class="dash-card free-training-card" onclick="startGrammarLessonFlow()">
                <div class="free-training-icon" style="background:rgba(74,222,128,0.15);color:#4ADE80">${savedLessonProgress ? '▶' : '📚'}</div>
                <div class="free-training-info">
                    <div class="free-training-title">${savedLessonProgress ? 'Continuer ma leçon' : "Commencer l'apprentissage"}</div>
                    <div class="free-training-sub">${savedLessonProgress ? `Reprends là où tu t'es arrêté · ${activeLevelLabel} Grammaire` : `Une nouvelle notion vous attend · ${activeLevelLabel} Grammaire`}</div>
                </div>
                <span class="free-training-chevron">→</span>
            </div>
            
            <div class="dash-card free-training-card" onclick="showExploreLessonsScreen()">
                <div class="free-training-icon" style="background:rgba(0,229,255,0.15);color:var(--accent)">🔎</div>
                <div class="free-training-info">
                    <div class="free-training-title">Explorer les leçons</div>
                    <div class="free-training-sub">Choisis librement une notion à revoir</div>
                </div>
                <span class="free-training-chevron">→</span>
            </div>
            
            <div class="apprendre-section-header">
                <span>Fiches</span>
            </div>
            
            <div class="apprendre-grid">
                <div class="apprendre-card" style="border-color:#4ADE8099; box-shadow:0 0 18px #4ADE8059;" onclick="showGrammarNiveauxScreen()">
                    <div class="apprendre-card-icon" style="background:rgba(74,222,128,0.15);color:#4ADE80;">文</div>
                    <div class="apprendre-card-title">Grammaire</div>
                    <div class="apprendre-card-sub">Une règle = une fiche</div>
                </div>
                <div class="apprendre-card" style="border-color:#FBBF2499; box-shadow:0 0 18px #FBBF2459;" onclick="showNiveauxScreen()">
                    <div class="apprendre-card-icon" style="background:rgba(251,191,36,0.15);color:#FBBF24;">語</div>
                    <div class="apprendre-card-title">Vocabulaire</div>
                    <div class="apprendre-card-sub">Mots par niveau JLPT</div>
                </div>
                <div class="apprendre-card" style="border-color:#00E5FF99; box-shadow:0 0 18px #00E5FF59;" onclick="showKanjiNiveauxScreen()">
                    <div class="apprendre-card-icon" style="background:rgba(0,229,255,0.15);color:var(--accent);">字</div>
                    <div class="apprendre-card-title">Kanji</div>
                    <div class="apprendre-card-sub">Caractères et tracé</div>
                </div>
                <div class="apprendre-card" style="border-color:#9D6EFF99; box-shadow:0 0 18px #9D6EFF59; background:#9D6EFF1f;" onclick="navKana()">
                    <div class="apprendre-card-icon" style="background:rgba(157,139,255,0.15);color:#9D6EFF;">あ</div>
                    <div class="apprendre-card-title">Kana</div>
                    <div class="apprendre-card-sub">Hiragana & Katakana</div>
                </div>
            </div>
        </div>`;
}

/* ══════════════════════════════════════════════════
   "COMMENÇONS L'APPRENTISSAGE" — MVP1 (grammaire uniquement, ordre linéaire imposé)
   ─────────────────────────────────────────────────
   Parcours : intro → sections (une à la fois) → exemples (un à la fois) → confusion
   (dernière "règle d'or" juste avant les exercices) → 3 exercices → fin.
   La leçon entre dans le SRS normal seulement à la fin (gradeReview), jamais avant —
   Apprendre et Réviser restent bien deux mécaniques séparées. Un échec aux exercices
   ne pénalise pas le SRS : ça alimente juste le tracker de faiblesse existant.
══════════════════════════════════════════════════ */
let lessonSession = null; // { lesson, steps, index, exAnswered, exSelected, exCorrectCount }

/* ══════════════════════════════════════════════════
   ONBOARDING "COMMENÇONS L'APPRENTISSAGE" — 5 slides d'introduction, affichées une seule fois
   avant la toute première leçon. Système léger et séparé de lessonSession (pas d'exercices, pas
   de SRS) pour ne pas fragiliser la logique de leçon réelle.
══════════════════════════════════════════════════ */
const LESSON_ONBOARDING_KEY = 'kanji_trad_lesson_onboarding_seen';
function hasSeenLessonOnboarding() {
    try { return localStorage.getItem(LESSON_ONBOARDING_KEY) === '1'; } catch (e) { return true; }
}
function markLessonOnboardingSeen() {
    try { localStorage.setItem(LESSON_ONBOARDING_KEY, '1'); } catch (e) {}
}

const LESSON_ONBOARDING_SLIDES = [
    {
        emoji: '🌸', title: 'Avant de commencer...',
        body: [
            "Félicitations pour avoir franchi le pas ! Le japonais est une langue fascinante, mais elle obéit à des logiques différentes du français.",
            "Pas de panique : ce module d'apprentissage est conçu pour vous guider pas à pas, à votre rythme."
        ],
        cta: 'Continuer'
    },
    {
        emoji: '📝', title: "Comment s'écrit le japonais ?",
        body: [
            "Le japonais utilise trois systèmes d'écriture mélangés :",
            "1. Les **Hiraganas** : L'alphabet phonétique de base (pour la grammaire et les terminaisons).",
            "2. Les **Katakanas** : L'autre alphabet phonétique, réservé aux mots d'origine étrangère.",
            "3. Les **Kanjis** : Les caractères d'origine chinoise, qui portent le sens principal des mots (comme 学生 pour « étudiant »)."
        ],
        cta: 'Les bases indispensables'
    },
    {
        emoji: '⏳', title: 'Kanas et régularité',
        body: [
            "**Apprendre les Kanas** : Mémorisez les 46 hiraganas et les 46 katakanas en priorité. Cela prend environ deux semaines en y consacrant 15 minutes par jour.",
            "En langues, 10 minutes par jour valent infiniment mieux que 2 heures une fois par semaine. Laissez l'algorithme SRS faire son travail au quotidien."
        ],
        cta: 'Le piège à éviter'
    },
    {
        emoji: '🚫', title: "Le piège de l'alphabet latin",
        body: [
            "Pour bien apprendre le japonais, commencez par maîtriser les syllabaires de base (hiragana et katakana) sans passer par la romanisation (romaji).",
            "Arrêtez d'utiliser l'alphabet latin pour lire le japonais afin de ne pas bloquer votre progression naturelle."
        ],
        cta: 'Dernier conseil'
    },
    {
        emoji: '🎧', title: 'Les clés sur le long terme',
        body: [
            "**Pratiquer la répétition** : Utilisez les cartes mémorielles pour ancrer durablement le vocabulaire.",
            "**S'immerger au quotidien** : Regardez des animes, écoutez des podcasts ou lisez des mangas originaux pour habituer votre oreille.",
            "**Aborder les Kanji progressivement** : Ne surchargez pas vos débuts, apprenez-les pas à pas une fois les bases acquises."
        ],
        cta: "C'est parti !"
    }
];

let onboardingIndex = 0;

function showLessonOnboarding() {
    pushModalState('lesson-onboarding');
    onboardingIndex = 0;
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    renderOnboardingSlide();
}

function renderOnboardingSlide() {
    const container = document.getElementById('category-content');
    if (!container) return;
    const slide = LESSON_ONBOARDING_SLIDES[onboardingIndex];
    const total = LESSON_ONBOARDING_SLIDES.length;
    const pct = total > 1 ? Math.round((onboardingIndex / (total - 1)) * 100) : 0;

    container.innerHTML = `
        <div class="review-page lesson-slide-anim">
            <div class="review-header">
                <button class="back-btn" onclick="skipLessonOnboarding()">✕</button>
                <div class="review-progress-bar"><div class="review-progress-fill" style="width:${pct}%"></div></div>
                <div class="review-progress-text">${onboardingIndex + 1}/${total}</div>
            </div>
            <div style="text-align:center;padding:24px 0 16px">
                <div style="font-size:3rem;margin-bottom:14px">${slide.emoji}</div>
                <div style="font-size:1.375rem;font-weight:bold;color:#fff">${slide.title}</div>
            </div>
            <div class="fiche-title-card" style="text-align:left;padding:20px">
                ${slide.body.map(p => `<div class="section-paragraph">${makeKanaWordsClickable(mdBold(p))}</div>`).join('')}
            </div>
            <button class="review-continue-btn" style="margin-top:20px" onclick="advanceOnboarding()">${slide.cta} (${onboardingIndex + 1}/${total})</button>
        </div>
    `;
}

function advanceOnboarding() {
    onboardingIndex++;
    if (onboardingIndex >= LESSON_ONBOARDING_SLIDES.length) {
        finishLessonOnboarding();
    } else {
        renderOnboardingSlide();
    }
}

// Table de référence hiragana/katakana en popup — réutilise kanaGroups déjà chargé en mémoire
// (aucun fetch nécessaire), affichage en lecture seule (pas de clic vers une fiche individuelle,
// pour éviter une popup dans la popup).
function buildKanaTablePopupContent(script) {
    const groups = (kanaGroups[script] || []).filter(g => !g.title);
    return groups.map(group => `
        <div class="kana-popup-rows">
            ${group.rows.map(row => `
                <div class="kana-popup-row">
                    ${row.map(k => k
                        ? `<div class="kana-popup-cell"><span class="kana-popup-char">${k.c}</span><span class="kana-popup-romaji">${k.r}</span></div>`
                        : `<div class="kana-popup-cell empty"></div>`
                    ).join('')}
                </div>
            `).join('')}
        </div>
    `).join('');
}

function showKanaTablePopup(script) {
    const modal = document.getElementById('kana-table-popup-modal');
    if (!modal) return;
    document.getElementById('kana-table-popup-title').textContent = script === 'hira' ? 'Hiragana' : 'Katakana';
    document.getElementById('kana-table-popup-content').innerHTML = buildKanaTablePopupContent(script);
    modal.classList.add('open');
    modal.style.display = 'flex';
}

function closeKanaTablePopup() {
    const modal = document.getElementById('kana-table-popup-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.style.display = 'none';
}

// Popup "voir aussi" : montre l'item + la section EXPLICATION (ou la première section) de la
// leçon visée par un champ "voir": "id_de_la_leçon" (dans confusions, sections ou examples).
function showLessonReferencePopup(lessonId) {
    const modal = document.getElementById('lesson-reference-popup-modal');
    const content = document.getElementById('lesson-reference-popup-content');
    if (!modal || !content) return;

    const lesson = findLessonByIdSync(lessonId);
    if (!lesson) {
        content.innerHTML = `<div style="color:var(--gray);text-align:center;padding:20px">Leçon introuvable.</div>`;
    } else {
        const explication = (lesson.sections || []).find(s => (s.label || '').toUpperCase() === 'EXPLICATION') || (lesson.sections || [])[0];
        content.innerHTML = `
            <div class="fiche-title-card" style="margin-bottom:14px">
                <div style="font-size:0.6875rem;color:var(--accent-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Leçon ${lesson.lesson_number || '?'}</div>
                <div style="font-size:1.375rem;color:var(--accent);font-weight:bold;font-family:'Noto Sans JP',sans-serif">${lesson.item || ''}</div>
                ${getItemRomaji(lesson.item, lesson.item_romaji) ? `<div style="font-size:0.75rem;color:var(--gray);margin-top:2px">${getItemRomaji(lesson.item, lesson.item_romaji)}</div>` : ''}
                <div style="font-size:0.9375rem;color:#fff;margin-top:6px">${lesson.title || ''}</div>
            </div>
            ${explication ? `<div class="fiche-title-card" style="text-align:left;padding:18px">${renderSectionBody(explication)}</div>` : `<div style="color:var(--gray);text-align:center">Pas d'explication disponible.</div>`}
            <button class="review-continue-btn" style="margin-top:16px" onclick="closeLessonReferencePopup();showGrammarDetail('${lesson.id}')">Voir la fiche complète →</button>
        `;
    }

    modal.classList.add('open');
    modal.style.display = 'flex';
}

function closeLessonReferencePopup() {
    const modal = document.getElementById('lesson-reference-popup-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.style.display = 'none';
}

// Rend "hiragana(s)"/"katakana(s)" cliquables dans le texte déjà passé par mdBold(), qu'ils
// soient déjà en gras (span.md-bold, ex: slide 2) ou en texte brut (ex: slides 3/4) — dans les
// deux cas, le résultat est mis en gras + cliquable, ouvre la table de référence en popup.
// 🔎 remplace l'ancien symbole ⮻, non pris en charge par certaines polices système.
function wrapKanaMentions(html, wordPattern, script) {
    const re = new RegExp(`<span class="md-bold">(${wordPattern})<\\/span>|\\b(${wordPattern})\\b`, 'gi');
    return html.replace(re, (match, boldWord, plainWord) => {
        const word = boldWord || plainWord;
        return `<span class="md-bold kana-word-trigger" onclick="showKanaTablePopup('${script}')">${word} 🔎</span>`;
    });
}

function makeKanaWordsClickable(html) {
    html = wrapKanaMentions(html, 'Hiraganas?', 'hira');
    html = wrapKanaMentions(html, 'Katakanas?', 'kata');
    return html;
}

function skipLessonOnboarding() {
    markLessonOnboardingSeen();
    history.back();
}

// Fin de l'introduction : marque comme vue, puis enchaîne directement sur la vraie leçon
function finishLessonOnboarding() {
    markLessonOnboardingSeen();
    startGrammarLessonFlowActual();
}

const LESSON_PROGRESS_KEY = 'kanji_trad_lesson_progress';

// Sauvegarde légère (id leçon + position + score en cours) — les étapes elles-mêmes sont
// reconstruites à la volée via buildLessonSteps() au retour, pas besoin de tout sérialiser.
function saveLessonProgress() {
    const s = lessonSession;
    if (!s) return;
    try {
        localStorage.setItem(LESSON_PROGRESS_KEY, JSON.stringify({
            lessonId: s.lesson.id,
            level: s.level || 'n5',
            index: s.index,
            exCorrectCount: s.exCorrectCount
        }));
    } catch (e) { /* stockage plein ou indisponible : tant pis, pas bloquant */ }
}

function clearLessonProgress() {
    try { localStorage.removeItem(LESSON_PROGRESS_KEY); } catch (e) {}
}

function getSavedLessonProgress() {
    try {
        const raw = localStorage.getItem(LESSON_PROGRESS_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

// Prochaine leçon jamais commencée (aucune info SRS), dans l'ordre lesson_number croissant.
// null si tout le niveau a déjà été entamé au moins une fois.
function findNextLessonToLearn(lessons) {
    const sorted = [...lessons].sort((a, b) => (a.lesson_number || 0) - (b.lesson_number || 0));
    return sorted.find(l => !getSrsInfo(l.id)) || null;
}

// Détermine quel niveau JLPT propose actuellement une leçon jamais commencée (N5 d'abord, puis
// N4, N3... une fois le niveau précédent épuisé). afterLevel permet de chercher STRICTEMENT
// après un niveau donné (utilisé par continueToNextLesson quand le niveau courant est épuisé).
async function findActiveLearningLevel(afterLevel = null) {
    let searching = !afterLevel;
    for (const levelId of ALL_JLPT_LEVELS) {
        if (!searching) {
            if (levelId === afterLevel) searching = true;
            continue;
        }
        const data = await getLevelGrammarData(levelId);
        if (data && data.data && data.data.length && findNextLessonToLearn(data.data)) {
            return levelId;
        }
    }
    return null;
}

// Construit les 3 exercices de fin : jusqu'à 2 cloze sur des exemples différents de LA leçon
// (distracteurs = particules courantes), puis 1 exercice basé sur la confusion documentée
// ("laquelle de ces phrases est correcte ?") si elle existe — teste la distinction, pas
// seulement la mémorisation, comme suggéré.
function buildLessonExercises(lesson) {
    const exercises = [];
    const usableExamples = (lesson.examples || []).filter(ex => ex.highlight && ex.japanese && ex.japanese.includes(ex.highlight));

    usableExamples.slice(0, 2).forEach(ex => {
        const correct = ex.highlight;
        const distractorPool = COMMON_PARTICLES.filter(p => p !== correct);
        const options = shuffleArray([correct, ...shuffleArray(distractorPool).slice(0, 2)]);
        exercises.push({ type: 'cloze', sentence: ex.japanese, correct, options, french: ex.french });
    });

    if (Array.isArray(lesson.confusions) && lesson.confusions.length && lesson.confusions[0].wrong_example) {
        const c = lesson.confusions[0];
        const correctFirst = Math.random() < 0.5; // évite que la bonne réponse soit toujours en position B
        exercises.push({
            type: 'confusion-check',
            optionA: correctFirst ? c.wrong_example.correct_japanese : c.wrong_example.japanese,
            optionB: correctFirst ? c.wrong_example.japanese : c.wrong_example.correct_japanese,
            correctOption: correctFirst ? 'A' : 'B',
            french: c.wrong_example.french,
            explanation: c.explanation
        });
    }

    return exercises.slice(0, 3);
}

function buildLessonSteps(lesson) {
    const steps = [{ type: 'intro' }];
    (lesson.sections || []).forEach(sec => {
        const paragraphs = [];
        if (sec.text) paragraphs.push(sec.text);
        if (Array.isArray(sec.paragraphs)) paragraphs.push(...sec.paragraphs);
        paragraphs.forEach((p, i) => steps.push({ type: 'paragraph', text: p, label: sec.label, first: i === 0 }));

        if (sec.sub_title || (Array.isArray(sec.list) && sec.list.length)) {
            steps.push({ type: 'structure', sub_title: sec.sub_title, list: sec.list });
        }
        if (Array.isArray(sec.blocks)) {
            sec.blocks.forEach(b => steps.push({ type: 'structure', sub_title: b.sub_title, list: b.list, paragraphs: b.paragraphs }));
        }
    });
    (lesson.examples || []).forEach(ex => steps.push({ type: 'example', example: ex }));
    if (Array.isArray(lesson.confusions) && lesson.confusions.length) {
        steps.push({ type: 'confusion', confusion: lesson.confusions[0] });
    }
    buildLessonExercises(lesson).forEach(ex => steps.push({ type: 'exercise', exercise: ex }));
    steps.push({ type: 'end' });
    return steps;
}

// Point d'entrée public : montre l'introduction 5 slides une seule fois (première utilisation),
// puis enchaîne directement sur la vraie leçon. Les appels suivants sautent l'introduction.
async function startGrammarLessonFlow() {
    if (!hasSeenLessonOnboarding()) {
        showLessonOnboarding();
        return;
    }
    await startGrammarLessonFlowActual();
}

async function startGrammarLessonFlowActual() {
    // Reprend une leçon interrompue si elle existe encore, sur SON niveau sauvegardé — sinon
    // détermine dynamiquement quel niveau propose actuellement du contenu neuf (N5 d'abord).
    const saved = getSavedLessonProgress();
    let level, lesson, resumeIndex = 0, resumeScore = 0;

    if (saved && saved.lessonId) {
        const savedData = await getLevelGrammarData(saved.level);
        const savedLesson = savedData && savedData.data ? savedData.data.find(l => l.id === saved.lessonId) : null;
        if (savedLesson) {
            level = saved.level;
            lesson = savedLesson;
            resumeIndex = saved.index;
            resumeScore = saved.exCorrectCount || 0;
        }
    }

    if (!lesson) {
        level = await findActiveLearningLevel();
        if (!level) {
            alert("Tu as déjà commencé toutes les leçons de grammaire disponibles ! 🎉 Direction Réviser pour les consolider.");
            return;
        }
        const data = await getLevelGrammarData(level);
        lesson = findNextLessonToLearn(data.data);
    }

    pushModalState('grammar-lesson-flow');
    const steps = buildLessonSteps(lesson);
    lessonSession = {
        lesson,
        level,
        steps,
        index: Math.min(resumeIndex, steps.length - 1),
        exAnswered: false,
        exSelected: null,
        exCorrectCount: resumeScore
    };
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    renderLessonStep();
}

function renderLessonStep() {
    const container = document.getElementById('category-content');
    if (!container || !lessonSession) return;
    const s = lessonSession;
    const step = s.steps[s.index];
    if (step.type === 'end') clearLessonProgress(); else saveLessonProgress();
    const pct = s.steps.length > 1 ? Math.round((s.index / (s.steps.length - 1)) * 100) : 0;

    const header = `
        <div class="review-header">
            <button class="back-btn" onclick="exitLessonFlow()">✕</button>
            <div class="review-progress-bar"><div class="review-progress-fill" style="width:${pct}%"></div></div>
            <div class="review-progress-text">${s.index + 1}/${s.steps.length}</div>
        </div>
    `;

    let body = '';
    if (step.type === 'intro') body = renderLessonIntro();
    else if (step.type === 'paragraph') body = renderLessonParagraph(step);
    else if (step.type === 'structure') body = renderLessonStructure(step);
    else if (step.type === 'example') body = renderLessonExample(step);
    else if (step.type === 'confusion') body = renderLessonConfusion(step);
    else if (step.type === 'exercise') body = renderLessonExercise(step);
    else if (step.type === 'end') body = renderLessonEnd();

    // innerHTML recrée un nœud DOM neuf à chaque appel, donc l'animation CSS ci-dessous se
    // rejoue automatiquement à chaque étape sans artifice supplémentaire.
    container.innerHTML = `<div class="review-page lesson-slide-anim">${step.type === 'end' ? '' : header}${body}</div>`;
}

function renderLessonIntro() {
    const l = lessonSession.lesson;
    return `
        <div class="fiche-title-card">
            <div style="font-size:0.6875rem;color:var(--accent-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">${l.unit_title || ''}</div>
            <div class="fiche-title-main">${l.title || ''}</div>
            <div style="font-size:2rem;color:var(--accent);margin:14px 0 4px;font-family:'Noto Sans JP',sans-serif">${l.item || ''}</div>
            ${getItemRomaji(l.item, l.item_romaji) ? `<div style="font-size:0.8125rem;color:var(--gray);margin-bottom:6px">${getItemRomaji(l.item, l.item_romaji)}</div>` : ''}
            <div class="fiche-title-reading">${l.badge || ''}</div>
            ${l.pattern ? `<div style="margin-top:14px;padding:10px;background:rgba(0,0,0,0.3);border-radius:8px;font-family:monospace;color:var(--gray);font-size:0.8125rem">${l.pattern}</div>` : ''}
        </div>
        <div style="text-align:center;color:var(--gray);font-size:0.75rem;margin:16px 0">⏱ 3-5 min · Nouvelle notion</div>
        <button class="review-continue-btn" onclick="advanceLessonStep()">Commencer →</button>
    `;
}

function renderLessonParagraph(step) {
    return `
        <div class="lesson-tap-advance" onclick="advanceLessonStep()">
            ${step.label ? `<div class="section-sub-title" style="text-align:center;margin-bottom:6px">${step.label}</div>` : ''}
            <div class="lesson-floating-text-wrap"><div class="lesson-floating-text">${mdBold(step.text || '')}</div></div>
            <div class="lesson-tap-hint">👆 Touche l'écran pour continuer</div>
        </div>
    `;
}

function renderLessonStructure(step) {
    return `
        <div class="lesson-tap-advance" onclick="advanceLessonStep()">
            <div class="fiche-title-card" style="text-align:left;padding:18px">
                ${step.sub_title ? `<div class="section-sub-title">${mdBold(step.sub_title)}</div>` : ''}
                ${Array.isArray(step.paragraphs) ? step.paragraphs.map(p => `<div class="section-paragraph">${mdBold(p)}</div>`).join('') : ''}
                ${Array.isArray(step.list) && step.list.length ? `<ul class="section-list">${step.list.map(item => `<li>${mdBold(item)}</li>`).join('')}</ul>` : ''}
            </div>
            <div class="lesson-tap-hint">👆 Touche l'écran pour continuer</div>
        </div>
    `;
}

function renderLessonExample(step) {
    const ex = step.example;
    return `
        <div class="lesson-tap-advance" onclick="advanceLessonStep()">
            <div class="section-sub-title" style="text-align:center;margin-bottom:6px">Exemple</div>
            <div class="lesson-floating-text-wrap">
                <div class="lesson-floating-text">
                    <div style="font-size:1.0625em;margin-bottom:10px">${mdBold(ex.japanese || '')}</div>
                    ${ex.romaji ? `<div style="font-size:0.7em;color:var(--accent-muted);margin-bottom:8px">${ex.romaji}</div>` : ''}
                    <div style="font-size:0.75em;color:var(--gray)">${mdBold(ex.french || '')}</div>
                </div>
            </div>
            <div class="lesson-tap-hint">👆 Touche l'écran pour continuer</div>
        </div>
    `;
}

function renderLessonConfusion(step) {
    return `
        <div class="lesson-tap-advance" onclick="advanceLessonStep()">
            <div class="section-sub-title" style="text-align:center;margin-bottom:10px">⚠️ Dernière règle d'or avant de t'entraîner</div>
            ${buildConfusionBoxHtml(step.confusion)}
            <div class="lesson-tap-hint">👆 Touche l'écran pour continuer</div>
        </div>
    `;
}

function renderLessonExercise(step) {
    const s = lessonSession;
    const ex = step.exercise;
    const answered = s.exAnswered;
    const selected = s.exSelected;
    let bodyHtml;

    if (ex.type === 'cloze') {
        const displayedSentence = answered
            ? ex.sentence.replace(ex.correct, `<span class="cloze-blank-filled ${selected === ex.correct ? 'correct' : 'incorrect'}">${selected}</span>`)
            : ex.sentence.replace(ex.correct, '<span class="cloze-blank">＿＿</span>');
        bodyHtml = `
            <div class="review-card review-cloze-card">
                <div class="review-quiz-instruction">Complète la phrase</div>
                <div class="cloze-sentence">${displayedSentence}</div>
                <div class="review-example-fr-only">${mdBold(ex.french || '')}</div>
            </div>
            <div class="review-options review-options-particles">
                ${ex.options.map(opt => {
                    let cls = 'review-option-btn';
                    if (answered) { if (opt === ex.correct) cls += ' correct'; else if (opt === selected) cls += ' incorrect'; }
                    return `<button class="${cls}" ${answered ? 'disabled' : ''} onclick="submitLessonExercise('${opt}')">${opt}</button>`;
                }).join('')}
            </div>
            ${answered && selected !== ex.correct ? buildWrongParticleMessageHtml(selected) : ''}
        `;
    } else { // confusion-check : la position de la bonne réponse est désormais aléatoire (correctOption)
        bodyHtml = `
            <div class="review-card"><div class="review-quiz-instruction">Laquelle de ces phrases est correcte ?</div></div>
            <div class="review-options" style="display:flex;flex-direction:column;gap:10px">
                <button class="review-option-btn ${answered ? (ex.correctOption === 'A' ? 'correct' : (selected === 'A' ? 'incorrect' : '')) : ''}" ${answered ? 'disabled' : ''} onclick="submitLessonExercise('A')" style="text-align:left">${ex.optionA}</button>
                <button class="review-option-btn ${answered ? (ex.correctOption === 'B' ? 'correct' : (selected === 'B' ? 'incorrect' : '')) : ''}" ${answered ? 'disabled' : ''} onclick="submitLessonExercise('B')" style="text-align:left">${ex.optionB}</button>
            </div>
            ${answered ? `<div class="vocab-nuance-box" style="margin-top:14px">💡 ${mdBold(ex.explanation || '')}</div>` : ''}
        `;
    }

    return `
        <div class="section-sub-title" style="text-align:center;margin-bottom:10px">Entraîne-toi</div>
        ${bodyHtml}
        ${answered ? `<button class="review-continue-btn" onclick="advanceLessonStep()" style="margin-top:16px">Continuer →</button>` : ''}
    `;
}

function renderLessonEnd() {
    const s = lessonSession;
    const l = s.lesson;
    const totalEx = s.steps.filter(st => st.type === 'exercise').length;
    const score = s.exCorrectCount;
    const passed = s.lessonPassed;

    const preview = s.nextLessonPreview;
    const nextLesson = preview ? preview.lesson : null;
    const levelChanged = preview && preview.level !== s.level;

    return `
        <div style="text-align:center;padding:20px 0">
            <div style="font-size:3rem;margin-bottom:10px">${passed ? '🎉' : '💪'}</div>
            <div style="font-size:1.5rem;font-weight:bold;color:#fff;margin-bottom:6px">${passed ? 'Leçon terminée !' : 'Presque !'}</div>
            <div style="font-size:1.0625rem;color:var(--gray);margin-bottom:20px">${l.title}</div>
            <div style="display:inline-block;background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.3);border-radius:12px;padding:12px 22px;color:#4ADE80;font-size:1.0625rem;margin-bottom:20px">${score} / ${totalEx} bonnes réponses</div>
            ${passed
                ? `<div style="font-size:0.9375rem;color:var(--gray);margin-bottom:24px;line-height:1.5">📅 Première révision programmée pour demain, dans "Réviser"</div>`
                : `<div style="font-size:0.9375rem;color:var(--gray);margin-bottom:24px;line-height:1.5">🧠 Cette notion a été ajoutée à "À renforcer" — pas de souci, tu la reverras</div>`}
        </div>
        ${nextLesson ? `
            <div class="fiche-title-card" style="margin-bottom:14px">
                <div style="font-size:0.6875rem;color:var(--accent-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">${levelChanged ? `🎊 Niveau suivant débloqué — ${preview.level.toUpperCase()}` : 'Prochaine leçon'}</div>
                <div style="font-size:1.375rem;color:var(--accent);font-weight:bold;font-family:'Noto Sans JP',sans-serif">${nextLesson.item || ''}</div>
                <div style="font-size:0.9375rem;color:#fff;margin-top:4px">${nextLesson.title || ''}</div>
            </div>
            <button class="review-continue-btn" onclick="continueToNextLesson()">Continuer →</button>
            <button class="bulk-select-toggle-btn" style="width:100%;max-width:340px;margin:10px auto 0;display:block;padding-top:14px;padding-bottom:14px;font-size:0.875rem" onclick="exitLessonFlow()">Retour à Apprendre</button>
        ` : `
            <button class="review-continue-btn" onclick="exitLessonFlow()">Retour à Apprendre</button>
        `}
        <button class="bulk-select-toggle-btn" style="width:100%;max-width:340px;margin:10px auto 0;display:block;padding-top:14px;padding-bottom:14px;font-size:0.875rem" onclick="startFreeTrainingFromLesson()">🏋️ Pratiquer en Entraînement libre</button>
    `;
}

// ── ÉCRAN "EXPLORER LES LEÇONS" — choix libre, sans verrouillage (le parcours linéaire par
// défaut reste "Commencer l'apprentissage" ; cet écran sert justement à s'en écarter) ──
async function showExploreLessonsScreen(isBack = false, initialLevel = null) {
    if (!isBack) history.pushState({ view: 'explore-lessons' }, '');
    document.getElementById('page-title').innerText = 'Explorer les leçons';
    const main = document.getElementById('main-content');
    const level = initialLevel || await findActiveLearningLevel() || 'n5';
    main.innerHTML = `
        <div style="padding:16px">
            <button class="back-btn" onclick="history.back()">←</button>
            <div class="apprendre-title-main" style="margin-top:10px">Explorer les leçons</div>
            <div id="explore-level-tabs" class="ft-radio-group ft-radio-pills" style="margin:14px 0"></div>
            <div id="explore-lessons-list"><div style="color:var(--gray);font-size:0.75rem;text-align:center;padding:20px">Chargement…</div></div>
        </div>
    `;
    await renderExploreLevelTabs(level);
    const data = await getLevelGrammarData(level);
    renderExploreLessonsList(data && data.data ? data.data : [], level);
}

// N'affiche que les niveaux ayant réellement du contenu grammaire (évite de proposer N3/N2/N1
// tant qu'ils sont vides)
async function renderExploreLevelTabs(activeLevel) {
    const el = document.getElementById('explore-level-tabs');
    if (!el) return;
    const available = [];
    for (const lv of ALL_JLPT_LEVELS) {
        const data = await getLevelGrammarData(lv);
        if (data && data.data && data.data.length) available.push(lv);
    }
    el.innerHTML = available.map(lv => `
        <label class="ft-radio-pill">
            <input type="radio" name="explore-level" ${lv === activeLevel ? 'checked' : ''} onclick="showExploreLessonsScreen(true, '${lv}')">
            <span>${lv.toUpperCase()}</span>
        </label>
    `).join('');
}

function renderExploreLessonsList(lessons, level) {
    const el = document.getElementById('explore-lessons-list');
    if (!el) return;
    if (!lessons.length) {
        el.innerHTML = `<div style="color:var(--gray);font-size:0.75rem;text-align:center;padding:20px">Aucune leçon disponible.</div>`;
        return;
    }
    const saved = getSavedLessonProgress();
    const sorted = [...lessons].sort((a, b) => (a.lesson_number || 0) - (b.lesson_number || 0));
    el.innerHTML = sorted.map(l => {
        const isInProgress = !!(saved && saved.lessonId === l.id);
        const isDone = !isInProgress && !!getSrsInfo(l.id);
        const icon = isInProgress ? '🔵' : (isDone ? '✔' : '⚪');
        const statusText = isInProgress ? 'En cours' : (isDone ? 'Terminée' : 'À découvrir');
        const statusColor = isInProgress ? 'var(--accent)' : (isDone ? '#4ADE80' : 'var(--gray)');
        const safeId = l.id.replace(/'/g, "\\'");
        return `
            <div class="explore-lesson-row" onclick="startSpecificGrammarLesson('${safeId}', '${level}')">
                <span class="explore-lesson-icon" style="color:${statusColor}">${icon}</span>
                <div class="explore-lesson-info">
                    <div class="explore-lesson-item">${l.item || ''}</div>
                    <div class="explore-lesson-title">${l.title || ''}</div>
                </div>
                <span class="explore-lesson-status" style="color:${statusColor}">${statusText}</span>
            </div>
        `;
    }).join('');
}

// Démarre (ou reprend, si c'est la leçon en cours) une leçon précise choisie depuis l'exploration
// libre — contrairement à startGrammarLessonFlow(), ignore l'ordre linéaire imposé.
async function startSpecificGrammarLesson(lessonId, level) {
    const data = await getLevelGrammarData(level);
    if (!data || !data.data) return;
    const lesson = data.data.find(l => l.id === lessonId);
    if (!lesson) return;

    const saved = getSavedLessonProgress();
    const resume = saved && saved.lessonId === lessonId;

    pushModalState('grammar-lesson-flow');
    const steps = buildLessonSteps(lesson);
    lessonSession = {
        lesson,
        level,
        steps,
        index: resume ? Math.min(saved.index, steps.length - 1) : 0,
        exAnswered: false,
        exSelected: null,
        exCorrectCount: resume ? (saved.exCorrectCount || 0) : 0
    };
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    renderLessonStep();
}

// Enchaîne directement sur la leçon suivante, sans repasser par l'écran Apprendre
function continueToNextLesson() {
    const s = lessonSession;
    const preview = s?.nextLessonPreview;
    if (!preview) { exitLessonFlow(); return; }
    lessonSession = {
        lesson: preview.lesson,
        level: preview.level,
        steps: buildLessonSteps(preview.lesson),
        index: 0,
        exAnswered: false,
        exSelected: null,
        exCorrectCount: 0
    };
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    renderLessonStep();
}

function submitLessonExercise(selected) {
    const s = lessonSession;
    if (!s || s.exAnswered) return;
    const step = s.steps[s.index];
    const ex = step.exercise;
    const isCorrect = ex.type === 'cloze' ? selected === ex.correct : selected === ex.correctOption;
    s.exAnswered = true;
    s.exSelected = selected;
    if (isCorrect) s.exCorrectCount++;
    renderLessonStep();
}

// Applique la transition SRS une seule fois, au moment précis où on atteint l'écran de fin —
// jamais pendant le rendu (qui peut être rappelé plusieurs fois pour la même étape).
async function applyLessonCompletion() {
    const s = lessonSession;
    const l = s.lesson;
    const totalEx = s.steps.filter(st => st.type === 'exercise').length;
    const score = s.exCorrectCount;
    const passed = totalEx === 0 || score >= Math.ceil(totalEx / 2);
    if (passed) {
        const quality = score === totalEx ? 2 : 1; // Bien si sans faute, Difficile sinon (mais validé)
        gradeReview(l.id, quality, { type: 'grammar', label: l.item || l.pattern });
    } else {
        updateWeaknessTracking(l.id, 0, { type: 'grammar', label: l.item || l.pattern });
    }
    s.lessonPassed = passed;

    // Précalcule l'aperçu de la prochaine leçon (y compris bascule automatique vers le niveau
    // suivant si celui-ci est épuisé) — une seule fois ici, pour un rendu de fin synchrone.
    let levelData = grammarDataCache[s.level];
    let nextLesson = levelData && levelData.data ? findNextLessonToLearn(levelData.data) : null;
    let nextLevel = s.level;
    if (!nextLesson) {
        const nextLevelId = await findActiveLearningLevel(s.level);
        if (nextLevelId) {
            nextLevel = nextLevelId;
            const data = await getLevelGrammarData(nextLevelId);
            nextLesson = data && data.data ? findNextLessonToLearn(data.data) : null;
        }
    }
    s.nextLessonPreview = nextLesson ? { level: nextLevel, lesson: nextLesson } : null;
}

async function advanceLessonStep() {
    const s = lessonSession;
    if (!s) return;
    s.index++;
    s.exAnswered = false;
    s.exSelected = null;
    const nextStep = s.steps[s.index];
    if (nextStep && nextStep.type === 'end' && !s.srsApplied) {
        s.srsApplied = true;
        await applyLessonCompletion();
    }
    renderLessonStep();
}

function exitLessonFlow() {
    history.back();
}

function startFreeTrainingFromLesson() {
    showFreeTrainingConfig(false, { type: 'grammar', level: 'n5' });
}

/* ══════════════════════════════════════════════════
   ÉCRAN "NIVEAUX GRAMMAIRE" (miroir de showNiveauxScreen, pour la grammaire)
══════════════════════════════════════════════════ */
async function showGrammarNiveauxScreen(isBack = false) {
    if (!isBack) history.pushState({ view: 'grammar-niveaux' }, '');
    const mainContent = document.getElementById('main-content');
    document.getElementById('page-title').innerText = 'Grammaire';
    
    if (!jlptMapping) {
        mainContent.innerHTML = '<div style="padding:20px;color:var(--gray)">Chargement des niveaux…</div>';
        return;
    }
    
    mainContent.innerHTML = `
        <div class="niveaux-wrap">
            <div class="niveaux-header">
                <div class="niveaux-title-main">Grammaire</div>
                <div class="niveaux-subtitle-main">Choisis ton niveau JLPT.</div>
            </div>
            <div id="niveaux-list">
                <div style="padding:20px;text-align:center;color:var(--gray)"><div class="spinner"></div></div>
            </div>
        </div>`;
    
    const listEl = document.getElementById('niveaux-list');
    const sortedLevels = Object.entries(jlptMapping.levels).sort((a, b) => a[1].order - b[1].order);
    
    const cardsHtml = await Promise.all(sortedLevels.map(async ([levelId, levelData]) => {
        const vg = await getLevelVocabGrammarStats(levelId);
        const hasData = vg.grammarTotal > 0;
        const pct = hasData ? Math.round((vg.grammarMastered / vg.grammarTotal) * 100) : 0;
        
        if (!hasData) {
            return `
                <div class="niveaux-card locked">
                    <div class="niveaux-badge" style="background:${levelData.color}22;color:${levelData.color};border:1px solid ${levelData.color}44">${levelData.label}</div>
                    <div class="niveaux-info">
                        <div class="niveaux-card-title">${levelData.label_full}</div>
                        <div class="niveaux-card-sub">${levelData.description}</div>
                    </div>
                    <div class="niveaux-soon">Bientôt</div>
                </div>`;
        }
        
        return `
            <div class="niveaux-card" style="border-color:${levelData.color}99; box-shadow:0 0 18px ${levelData.color}59; background:${levelData.color}1f;" onclick="showCategoryDirect('${levelId}','grammar')">
                <div class="niveaux-badge" style="background:${levelData.color}22;color:${levelData.color};border:1px solid ${levelData.color}44">${levelData.label}</div>
                <div class="niveaux-info">
                    <div class="niveaux-card-title">${levelData.label_full}</div>
                    <div class="niveaux-card-sub">${vg.grammarMastered} / ${vg.grammarTotal} leçons</div>
                    <div class="niveaux-progress-bar"><div class="niveaux-progress-fill" style="width:${pct}%;background:${levelData.color}"></div></div>
                    ${buildNiveauxWaveSvg(levelData.color)}
                </div>
                <div class="niveaux-pct">${pct}%</div>
            </div>`;
    }));
    
    listEl.innerHTML = cardsHtml.join('');
}

/* ══════════════════════════════════════════════════
   ÉCRAN "NIVEAUX KANJI" (miroir, mais données déjà en mémoire via kanjiDb — pas de fetch)
══════════════════════════════════════════════════ */
async function showKanjiNiveauxScreen(isBack = false) {
    if (!isBack) history.pushState({ view: 'kanji-niveaux' }, '');
    const mainContent = document.getElementById('main-content');
    document.getElementById('page-title').innerText = 'Kanji';
    
    if (!jlptMapping) {
        mainContent.innerHTML = '<div style="padding:20px;color:var(--gray)">Chargement des niveaux…</div>';
        return;
    }
    
    const sortedLevels = Object.entries(jlptMapping.levels).sort((a, b) => a[1].order - b[1].order);
    
    const cardsHtml = (await Promise.all(sortedLevels.map(async ([levelId, levelData]) => {
        const chars = await getLevelKanjiChars(levelId) || [];
        const totalKanji = chars.length;
        const totalMastery = chars.reduce((sum, c) => sum + getKanjiMastery(c), 0);
        const avgMastery = chars.length > 0 ? Math.round(totalMastery / chars.length) : 0;
        
        return `
            <div class="niveaux-card" style="border-color:${levelData.color}99; box-shadow:0 0 18px ${levelData.color}59; background:${levelData.color}1f;" onclick="showCategoryDirect('${levelId}','kanji')">
                <div class="niveaux-badge" style="background:${levelData.color}22;color:${levelData.color};border:1px solid ${levelData.color}44">${levelData.label}</div>
                <div class="niveaux-info">
                    <div class="niveaux-card-title">${levelData.label_full}</div>
                    <div class="niveaux-card-sub">${totalKanji} kanji · ${avgMastery}% en moyenne</div>
                    <div class="niveaux-progress-bar"><div class="niveaux-progress-fill" style="width:${avgMastery}%;background:${levelData.color}"></div></div>
                    ${buildNiveauxWaveSvg(levelData.color)}
                </div>
                <div class="niveaux-pct">${avgMastery}%</div>
            </div>`;
    }))).join('');
    
    mainContent.innerHTML = `
        <div class="niveaux-wrap">
            <div class="niveaux-header">
                <div class="niveaux-title-main">Kanji</div>
                <div class="niveaux-subtitle-main">Choisis ton niveau JLPT.</div>
            </div>
            <div id="niveaux-list">${cardsHtml}</div>
        </div>`;
}

/* ══════════════════════════════════════════════════
   ONGLET "RÉVISIONS" — choix catégorie -> choix niveau/script -> lance direct la révision
══════════════════════════════════════════════════ */
async function showRevisionsScreen(isBack = false) {
    if (!isBack) history.pushState({ view: 'revisions' }, '');
    document.getElementById('page-title').innerText = 'Réviser';
    const main = document.getElementById('main-content');

    main.innerHTML = `
        <div class="apprendre-wrap">
            <div class="apprendre-header">
                <div class="apprendre-title-main">Réviser</div>
                <div class="apprendre-subtitle-main">Choisis une catégorie à réviser.</div>
            </div>
            <div class="dash-card free-training-card" onclick="showFreeTrainingConfig()">
                <div class="free-training-icon">復</div>
                <div class="free-training-info">
                    <div class="free-training-title">Entraînement libre <span class="free-training-badge">LIBRE</span></div>
                    <div class="free-training-sub">Feuillette tes mots vus · sans effet sur tes révisions</div>
                </div>
                <span class="free-training-chevron">→</span>
            </div>
            <div class="apprendre-grid">
                <div class="apprendre-card" style="border-color:#4ADE8099; box-shadow:0 0 18px #4ADE8059;" onclick="showRevisionLevelPicker('grammar')">
                    <div class="apprendre-card-icon" style="background:rgba(74,222,128,0.15);color:#4ADE80;">文</div>
                    <div class="apprendre-card-title">Grammaire</div>
                    <div class="apprendre-card-sub">Choisir un niveau</div>
                </div>
                <div class="apprendre-card" style="border-color:#FBBF2499; box-shadow:0 0 18px #FBBF2459;" onclick="showRevisionLevelPicker('vocab')">
                    <div class="apprendre-card-icon" style="background:rgba(251,191,36,0.15);color:#FBBF24;">語</div>
                    <div class="apprendre-card-title">Vocabulaire</div>
                    <div class="apprendre-card-sub">Choisir un niveau</div>
                </div>
                <div class="apprendre-card" style="border-color:#00E5FF99; box-shadow:0 0 18px #00E5FF59;" onclick="showRevisionLevelPicker('kanji')">
                    <div class="apprendre-card-icon" style="background:rgba(0,229,255,0.15);color:var(--accent);">字</div>
                    <div class="apprendre-card-title">Kanji</div>
                    <div class="apprendre-card-sub">Choisir un niveau</div>
                </div>
                <div class="apprendre-card" style="border-color:#9D6EFF99; box-shadow:0 0 18px #9D6EFF59; background:#9D6EFF1f;" onclick="showRevisionKanaPicker()">
                    <div class="apprendre-card-icon" style="background:rgba(157,139,255,0.15);color:#9D6EFF;">あ</div>
                    <div class="apprendre-card-title">Kana</div>
                    <div class="apprendre-card-sub">Hiragana / Katakana</div>
                </div>
            </div>
        </div>`;
}

async function showRevisionLevelPicker(category, isBack = false) {
    if (!isBack) history.pushState({ view: 'revision-level-picker', category }, '');
    document.getElementById('page-title').innerText = 'Réviser';
    const main = document.getElementById('main-content');

    if (!jlptMapping) {
        main.innerHTML = '<div style="padding:20px;color:var(--gray)">Chargement des niveaux…</div>';
        return;
    }

    const labels = { grammar: 'Grammaire', vocab: 'Vocabulaire', kanji: 'Kanji' };

    main.innerHTML = `
        <div class="niveaux-wrap">
            <div class="niveaux-header">
                <div class="niveaux-title-main">${labels[category]}</div>
                <div class="niveaux-subtitle-main">Choisis le niveau à réviser.</div>
            </div>
            <div id="niveaux-list">
                <div style="padding:20px;text-align:center;color:var(--gray)"><div class="spinner"></div></div>
            </div>
        </div>`;

    const listEl = document.getElementById('niveaux-list');
    const sortedLevels = Object.entries(jlptMapping.levels).sort((a, b) => a[1].order - b[1].order);

    const cardsHtml = await Promise.all(sortedLevels.map(async ([levelId, levelData]) => {
        let hasData = false;

        if (category === 'kanji') {
            hasData = true; // kanjiDb toujours en mémoire, tous les niveaux dispo
        } else {
            const vg = await getLevelVocabGrammarStats(levelId);
            hasData = category === 'vocab' ? vg.vocabTotal > 0 : vg.grammarTotal > 0;
        }

        if (!hasData) {
            return `
                <div class="niveaux-card locked">
                    <div class="niveaux-badge" style="background:${levelData.color}22;color:${levelData.color};border:1px solid ${levelData.color}44">${levelData.label}</div>
                    <div class="niveaux-info">
                        <div class="niveaux-card-title">${levelData.label_full}</div>
                        <div class="niveaux-card-sub">${levelData.description}</div>
                    </div>
                    <div class="niveaux-soon">Bientôt</div>
                </div>`;
        }

        return `
            <div class="niveaux-card" style="border-color:${levelData.color}99; box-shadow:0 0 18px ${levelData.color}59; background:${levelData.color}1f;" onclick="startRevisionFor('${category}','${levelId}')">
                <div class="niveaux-badge" style="background:${levelData.color}22;color:${levelData.color};border:1px solid ${levelData.color}44">${levelData.label}</div>
                <div class="niveaux-info">
                    <div class="niveaux-card-title">${levelData.label_full}</div>
                    <div class="niveaux-card-sub">Toucher pour réviser</div>
                    ${buildNiveauxWaveSvg(levelData.color)}
                </div>
            </div>`;
    }));

    listEl.innerHTML = cardsHtml.join('');
}

async function startRevisionFor(category, levelId) {
    if (category === 'vocab') {
        const vd = await getLevelVocabData(levelId);
        if (!vd || !vd.data) { alert("Aucune donnée disponible pour ce niveau."); return; }
        vocabHomeData = { levelId, data: vd.data, examples: vd.examples };
        currentLevelId = levelId;
        document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
        showVocabReviewModeSelector();
    } else if (category === 'grammar') {
        const gd = await getLevelGrammarData(levelId);
        if (!gd || !gd.data) { alert("Aucune donnée disponible pour ce niveau."); return; }
        grammarHomeData = { levelId, data: gd.data, examples: null };
        document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
        showGrammarReviewModeSelector();
    } else if (category === 'kanji') {
        const chars = await getLevelKanjiChars(levelId);
        kanjiHomeData = { levelId, chars: chars || [] };
        document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
        showKanjiReviewModeSelector();
    }
}

/* ── RÉVISION KANA (flashcard fonctionnel ; tracé normal/hardcore à venir) ── */
function getKanaFlatList(script) {
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

function getDueKanaChars(script) {
    const list = getKanaFlatList(script);
    const due = buildDueQueue(list.map(k => ({ id: k.id })));
    return due.map(item => list.find(k => k.id === item.id)).filter(Boolean);
}

async function showRevisionKanaPicker(isBack = false) {
    if (!isBack) history.pushState({ view: 'revision-kana-picker' }, '');
    document.getElementById('page-title').innerText = 'Réviser';
    const main = document.getElementById('main-content');

    main.innerHTML = `
        <div class="niveaux-wrap">
            <div class="niveaux-header">
                <div class="niveaux-title-main">Kana</div>
                <div class="niveaux-subtitle-main">Choisis le syllabaire à réviser.</div>
            </div>
            <div id="niveaux-list">
                <div class="niveaux-card" style="border-color:#9D6EFF99; box-shadow:0 0 18px #9D6EFF59; background:#9D6EFF1f;" onclick="showKanaRevisionModeSelector('hira')">
                    <div class="niveaux-badge" style="background:#9D6EFF22;color:#9D6EFF;border:1px solid #9D6EFF44">あ</div>
                    <div class="niveaux-info"><div class="niveaux-card-title">Hiragana</div><div class="niveaux-card-sub">Toucher pour réviser</div></div>
                </div>
                <div class="niveaux-card" style="border-color:#9D6EFF99; box-shadow:0 0 18px #9D6EFF59; background:#9D6EFF1f;" onclick="showKanaRevisionModeSelector('kata')">
                    <div class="niveaux-badge" style="background:#9D6EFF22;color:#9D6EFF;border:1px solid #9D6EFF44">ア</div>
                    <div class="niveaux-info"><div class="niveaux-card-title">Katakana</div><div class="niveaux-card-sub">Toucher pour réviser</div></div>
                </div>
                <div class="niveaux-card" style="border-color:#9D6EFF99; box-shadow:0 0 18px #9D6EFF59; background:#9D6EFF1f;" onclick="showKanaRevisionModeSelector('both')">
                    <div class="niveaux-badge" style="background:#9D6EFF22;color:#9D6EFF;border:1px solid #9D6EFF44">両</div>
                    <div class="niveaux-info"><div class="niveaux-card-title">Les deux</div><div class="niveaux-card-sub">Hiragana + Katakana</div></div>
                </div>
            </div>
        </div>`;
}

function showKanaRevisionModeSelector(script) {
    const dueKana = getDueKanaChars(script);
    if (dueKana.length === 0) {
        alert('Rien à réviser pour le moment ! 🎉');
        return;
    }

    pushModalState('kana-mode-selector');
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    document.getElementById('category-content').innerHTML = `
        <div class="review-mode-selector">
            <button class="back-btn" onclick="history.back()">←</button>
            <div class="review-mode-title">Choisis ton mode de révision</div>
            <div class="review-mode-count">${dueKana.length} kana à revoir</div>

            <button class="review-mode-btn" onclick="startKanaFlashcardReview('${script}')">
                <span class="review-mode-icon">🗂️</span>
                <div><div class="review-mode-name">Flashcard</div><div class="review-mode-desc">Lecture romaji</div></div>
            </button>
            <button class="review-mode-btn" onclick="startKanaTraceReview('${script}','trace-easy')">
                <span class="review-mode-icon">✍️</span>
                <div><div class="review-mode-name">Tracé normal</div><div class="review-mode-desc">Ordre des traits avec aide visuelle</div></div>
            </button>
            <button class="review-mode-btn" onclick="startKanaTraceReview('${script}','trace-hard')">
                <span class="review-mode-icon">🔥</span>
                <div><div class="review-mode-name">Tracé difficile</div><div class="review-mode-desc">Sans ombre — de mémoire pure</div></div>
            </button>
        </div>`;
}

let kanaReviewSession = null;

function startKanaFlashcardReview(script) {
    const dueKana = getDueKanaChars(script);
    if (dueKana.length === 0) return;

    pushModalState('kana-review-flashcard');
    kanaReviewSession = {
        queue: dueKana,
        index: 0,
        results: { again: 0, hard: 0, good: 0, easy: 0 },
        flipped: false
    };
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    renderKanaReviewScreen();
}

function renderKanaReviewScreen() {
    const container = document.getElementById('category-content');
    const session = kanaReviewSession;

    if (!session || session.index >= session.queue.length) {
        renderKanaReviewSummary();
        return;
    }

    const kana = session.queue[session.index];
    const progress = session.index + 1;
    const total = session.queue.length;
    const flipped = session.flipped;

    container.innerHTML = `<div class="review-page">
        <div class="review-header">
            <button class="back-btn" onclick="history.back()">✕</button>
            <div class="review-progress-bar"><div class="review-progress-fill" style="width:${(session.index / total) * 100}%"></div></div>
            <div class="review-progress-text">${progress} / ${total}</div>
        </div>
        <div class="review-card ${flipped ? 'flipped' : ''}" onclick="${flipped ? '' : 'flipKanaReviewCard()'}">
            <div class="review-card-front">
                <div class="review-word" style="font-size:56px;">${kana.char}</div>
            </div>
            ${flipped ? `<div class="review-card-back"><div class="review-meaning">${kana.romaji}</div></div>` : `<div class="review-tap-hint">Touche la carte pour révéler</div>`}
        </div>
        ${flipped ? `
            <div class="review-grade-buttons">
                <button class="grade-btn grade-again" onclick="submitKanaReviewGrade(0)">Encore</button>
                <button class="grade-btn grade-hard" onclick="submitKanaReviewGrade(1)">Difficile</button>
                <button class="grade-btn grade-good" onclick="submitKanaReviewGrade(2)">Bien</button>
                <button class="grade-btn grade-easy" onclick="submitKanaReviewGrade(3)">Facile</button>
            </div>
        ` : ''}
    </div>`;
}

function flipKanaReviewCard() {
    if (!kanaReviewSession) return;
    kanaReviewSession.flipped = true;
    renderKanaReviewScreen();
}

function submitKanaReviewGrade(quality) {
    if (!kanaReviewSession) return;
    const kana = kanaReviewSession.queue[kanaReviewSession.index];
    gradeReview(kana.id, quality, { type: 'kana', label: kana.char });
    if (quality === 0) scheduleRelearning(kanaReviewSession, kana);

    const labels = ['again', 'hard', 'good', 'easy'];
    kanaReviewSession.results[labels[quality]]++;

    kanaReviewSession.index++;
    kanaReviewSession.flipped = false;
    renderKanaReviewScreen();
}

function renderKanaReviewSummary() {
    recordSessionCompleted();
    const container = document.getElementById('category-content');
    const r = kanaReviewSession.results;
    const total = kanaReviewSession.queue.length;

    container.innerHTML = `<div class="review-summary">
        <div class="review-summary-title">Session terminée ! 🎉</div>
        <div class="review-summary-count">${total} kana révisé${total > 1 ? 's' : ''}</div>
        <div class="review-summary-stats">
            <div class="review-stat"><span class="review-stat-dot again"></span>Encore : ${r.again}</div>
            <div class="review-stat"><span class="review-stat-dot hard"></span>Difficile : ${r.hard}</div>
            <div class="review-stat"><span class="review-stat-dot good"></span>Bien : ${r.good}</div>
            <div class="review-stat"><span class="review-stat-dot easy"></span>Facile : ${r.easy}</div>
        </div>
        <button class="revise-btn" style="margin-top:20px;" onclick="history.back()">Retour</button>
    </div>`;
    kanaReviewSession = null;
}


/* ══════════════════════════════════════════════════
   RÉVISION MIXTE (Vocab + Grammaire + Kanji-flashcard, mélangés)
   Les modes tracé kanji restent séparés (accessibles via Kanji → niveau → Réviser)
══════════════════════════════════════════════════ */
const grammarDataCache = {};
const kanjiCharsCache = {};

// Aplatit défensivement une liste imbriquée par erreur — piège classique quand un lot de
// leçons/mots collé depuis Gemini est inséré comme UN SEUL élément (une liste imbriquée) au
// lieu d'être éclaté dans le tableau principal. Rend l'app robuste à cette faute de frappe une
// fois pour toutes, plutôt que de devoir la détecter et la corriger manuellement à chaque
// nouveau niveau (déjà rencontré sur le N5 puis le N4).
function flattenIfNested(arr) {
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

async function getLevelGrammarData(levelId) {
    if (levelId in grammarDataCache) return grammarDataCache[levelId];
    try {
        const res = await fetch(`./data/${levelId}/grammar.json`, { cache: 'no-store' });
        grammarDataCache[levelId] = res.ok ? { data: flattenIfNested(await res.json()) } : null;
    } catch (e) {
        grammarDataCache[levelId] = null;
    }
    return grammarDataCache[levelId];
}

// Précharge la grammaire de tous les niveaux JLPT en arrière-plan (fire-and-forget, appelé une
// fois au démarrage) — permet ensuite des recherches SYNCHRONES via findLessonByIdSync(), utile
// pour le système de renvoi "voir" entre leçons qui doit fonctionner dans des contextes de rendu
// synchrones (boîte de confusion affichée à plusieurs endroits différents).
function preloadAllGrammarLevels() {
    ALL_JLPT_LEVELS.forEach(level => { getLevelGrammarData(level); });
}

// Recherche synchrone d'une leçon de grammaire par son id, dans le cache déjà chargé. Le niveau
// est déduit du préfixe de l'id (ex: "n4_g_4" -> "n4"). Retourne null si pas encore en cache ou
// introuvable — le badge "voir" se contente alors de ne rien afficher, sans erreur.
function findLessonByIdSync(lessonId) {
    if (!lessonId) return null;
    const level = lessonId.split('_')[0];
    const cached = grammarDataCache[level];
    if (!cached || !cached.data) return null;
    return cached.data.find(l => l.id === lessonId) || null;
}

// Cherche une leçon de grammaire par son item exact (ou première forme avant "/"), tous niveaux
// déjà préchargés confondus — utilisé pour expliquer la particule choisie par erreur dans un quiz,
// quel que soit son niveau JLPT réel.
function findLessonByItemSync(itemText) {
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

// Messages d'accroche variés pour ne pas lasser avec toujours la même phrase — l'explication de
// la particule mal choisie s'affiche séparément en dessous (les EXPLICATION de grammar.json sont
// des phrases complètes, pas des fragments à compléter grammaticalement).
const WRONG_PARTICLE_INTROS = [
    p => `Oups, presque ! Mais **${p}** ne sert pas à ça.`,
    p => `Bien tenté, mais ce n'est pas tout à fait ça.`,
    p => `Pas de panique, c'est un classique !`,
    p => `Aïe, raté de peu !`,
    p => `Piégé(e) !`,
    p => `Pas de chance, c'était un piège japonais sournois.`,
    p => `Erreur de parcours !`,
    p => `Ce n'est pas la bonne, mais retiens bien ceci :`
];

// Construit le message affiché quand la particule sélectionnée est fausse — retrouve la leçon
// correspondant à CETTE particule (pas celle attendue) via son item, et affiche sa vraie
// explication (section EXPLICATION), pour que l'erreur devienne un moment d'apprentissage.
function buildWrongParticleMessageHtml(selected) {
    const wrongLesson = findLessonByItemSync(selected);
    if (!wrongLesson) return '';
    const explication = (wrongLesson.sections || []).find(s => (s.label || '').toUpperCase() === 'EXPLICATION');
    const explanationText = explication && Array.isArray(explication.paragraphs) ? explication.paragraphs[0] : null;
    if (!explanationText) return '';
    const intro = WRONG_PARTICLE_INTROS[Math.floor(Math.random() * WRONG_PARTICLE_INTROS.length)](selected);
    return `
        <div class="wrong-particle-box">
            <div class="wrong-particle-intro">${mdBold(intro)}</div>
            <div class="wrong-particle-explanation">${mdBold(explanationText)}</div>
        </div>
    `;
}

async function getLevelKanjiChars(levelId) {
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

// Utilisée par l'onglet "Apprendre" (carte héro) — quota GLOBAL de 10 nouvelles
// pour toute la session mixte (avant : 10 par combinaison type×niveau, ce qui
// pouvait aller jusqu'à 150 nouvelles cartes d'un coup). Voir buildReviewQueue().
let mixedReviewSession = null; // { queue: [{type, item}], index, results, flipped }

// Partagé entre l'onglet "Apprendre" et le bouton "Réviser aujourd'hui" de l'accueil :
// les deux lancent le même mécanisme de session mixte, seule la file en entrée et le
// nom d'état modal (donc la destination du bouton retour) diffèrent.
function launchMixedReviewSession(queue, exitState = 'apprendre-discovery', trackDailyQuota = false) {
    if (queue.length === 0) {
        alert("Rien à réviser aujourd'hui, tous types confondus ! 🎉");
        return;
    }

    pushModalState(exitState);

    mixedReviewSession = {
        queue,
        index: 0,
        results: { again: 0, hard: 0, good: 0, easy: 0 },
        flipped: false,
        trackDailyQuota // true uniquement pour "Réviser aujourd'hui" (accueil) — crédite le quota
                         // journalier carte par carte au fur et à mesure de la notation, pas
                         // d'un coup au lancement (sinon quitter en cours de session faisait
                         // croire à tort que tout avait déjà été vu)
    };

    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    renderMixedReviewScreen();
}

// Détermine front/back/typeLabel/frontSize d'une carte à partir de son entrée { type, level, item } —
// factorisé pour être partagé entre la révision mixte ET l'entraînement libre (même contenu affiché,
// seuls les boutons de réponse changent selon le contexte).
function buildCardDisplay(entry) {
    let front = '', back = '', typeLabel = '', frontSize = 36;

    if (entry.type === 'vocab') {
        const w = entry.item;
        typeLabel = '📚 Vocabulaire';
        front = w.word || '';
        back = `<div class="review-romaji">${w.reading || ''} · ${w.romaji || ''}</div><div class="review-meaning">${mdBold(getPrimaryMeaning(w))}</div>`;
    } else if (entry.type === 'grammar') {
        const l = entry.item;
        typeLabel = '📝 Grammaire';
        front = l.item || l.pattern || '';
        frontSize = 28;
        back = `<div class="review-reading">${l.title || ''}</div><div class="review-romaji">${l.pattern || ''}</div>`;
    } else if (entry.type === 'kanji') {
        const char = entry.item.char;
        const kanjiData = kanjiDb.find(k => k.char === char);
        typeLabel = '🔤 Kanji';
        front = char;
        frontSize = 56;
        const meanings = (kanjiData?.meanings || []).filter(m => !m.toLowerCase().includes('radical'));
        const on = kanjiData?.on || [];
        const kun = kanjiData?.kun || [];
        back = `${on.length ? `<div class="review-romaji">On : ${on.slice(0, 3).join('、')}</div>` : ''}${kun.length ? `<div class="review-romaji">Kun : ${kun.slice(0, 3).join('、')}</div>` : ''}<div class="review-meaning">${meanings.slice(0, 3).join(' / ') || '–'}</div>`;
    } else if (entry.type === 'kana') {
        const k = entry.item;
        typeLabel = (entry.level === 'kata') ? 'ア Katakana' : 'あ Hiragana';
        front = k.char || '';
        frontSize = 56;
        back = `<div class="review-meaning">${k.romaji || ''}</div>`;
    }

    return { front, back, typeLabel, frontSize };
}

// Id de tracking d'une entrée { type, item } — même convention que trackItem/gradeReview
// (kanji : le caractère lui-même ; les autres : item.id déjà au bon format).
function getEntryTrackingId(entry) {
    return entry.type === 'kanji' ? entry.item.char : entry.item.id;
}

// Libellé court et lisible d'une entrée générique { type, item } — utilisé par le widget
// "À renforcer" pour afficher quelque chose de compréhensible sans avoir à tout re-résoudre.
function getEntryLabel(entry) {
    if (entry.type === 'vocab')   return entry.item.word || entry.item.id;
    if (entry.type === 'grammar') return entry.item.item || entry.item.pattern || entry.item.id;
    if (entry.type === 'kanji')   return entry.item.char;
    if (entry.type === 'kana')    return entry.item.char || entry.item.c;
    return '';
}

/* ══════════════════════════════════════════════════
   CORRECTION CONTEXTUELLE (point #9) — mini-fiche accessible
   depuis le dos d'une carte de révision mixte, une fois retournée.
   Réutilise buildCardDisplay() : aucune nouvelle logique de contenu,
   juste un habillage modal par-dessus la session en cours (ne casse
   pas son état, contrairement à une navigation vers la vraie fiche).
══════════════════════════════════════════════════ */
// Contenu détaillé pour la fiche de correction — DÉLIBÉRÉMENT plus riche que buildCardDisplay()
// (qui ne montre que ce que la carte affiche déjà). Utilise uniquement des données déjà en
// mémoire sur l'item (pas de nouveau fetch) : les exemples vocab/grammaire sont inline dans
// les données JSON, contrairement aux exemples kanji qui vivent dans exemples.json à part —
// on ne les inclut donc pas ici pour rester synchrone et rapide.
function buildFicheDetailContent(entry) {
    let title = '', body = '';

    if (entry.type === 'vocab') {
        const w = entry.item;
        title = ''; // le mot vit dans sa propre boîte ci-dessous, pas dans le titre générique
        const m = w.meanings;
        const meaningsArr = Array.isArray(m) ? m : (m && typeof m === 'object' ? [m.primary, ...(m.secondary || [])].filter(Boolean) : [m].filter(Boolean));
        body = `
            <div class="fiche-title-card">
                <div class="fiche-title-main">${w.word || ''}</div>
                ${(w.reading || w.romaji) ? `<div class="fiche-title-reading">${w.reading || ''}${w.romaji ? ' · ' + w.romaji : ''}</div>` : ''}
                <div class="fiche-title-meaning">${mdBold(meaningsArr.join(' · ') || '–')}</div>
            </div>
            ${w.nuance ? `<div class="vocab-nuance-box" style="margin-top:10px">💡 ${mdBold(w.nuance)}</div>` : ''}
            ${w.example && w.example.japanese ? `
                <div class="vocab-example-box" style="margin-top:10px">
                    <div class="example-jp">${mdBold(w.example.japanese)}</div>
                    ${w.example.romaji ? `<div class="example-ro">${w.example.romaji}</div>` : ''}
                    <div class="example-fr">${mdBold(w.example.french || '')}</div>
                </div>` : ''}
        `;
    } else if (entry.type === 'grammar') {
        const l = entry.item;
        title = ''; // le motif vit dans sa propre boîte ci-dessous, pas dans le titre générique
        const sectionsHtml = Array.isArray(l.sections) ? l.sections.map(sec => `
            ${sec.label ? `<div class="section-sub-title">${sec.label}</div>` : ''}
            ${renderSectionBody(sec)}
        `).join('') : '';
        const examplesHtml = Array.isArray(l.examples) && l.examples.length ? `
            <div class="section-sub-title">Exemples</div>
            ${l.examples.slice(0, 2).map(ex => `
                <div class="vocab-example-box" style="margin-bottom:8px">
                    <div class="example-jp">${mdBold(ex.japanese || '')}</div>
                    <div class="example-fr">${mdBold(ex.french || '')}</div>
                </div>
            `).join('')}
        ` : '';
        const confusionsHtml = Array.isArray(l.confusions) && l.confusions.length
            ? l.confusions.map(c => buildConfusionBoxHtml(c)).join('')
            : '';
        body = `
            <div class="fiche-title-card">
                <div class="fiche-title-main">${l.item || l.pattern || ''}</div>
                ${(l.title || l.meaning) ? `<div class="fiche-title-meaning">${l.title || l.meaning || ''}</div>` : ''}
            </div>
            ${sectionsHtml}
            ${examplesHtml}
            ${confusionsHtml}
        `;
    } else if (entry.type === 'kanji') {
        const char = entry.item.char;
        const k = kanjiDb.find(x => x.char === char);
        title = ''; // le caractère vit dans la carte décorative ci-dessous, pas dans le titre générique
        const level = k ? getJLPTLevel(k.grade) : null;
        const onTags = (k?.on || []).map(r => `<span class="tag tag-on">${r}</span>`).join('');
        const kunTags = (k?.kun || []).map(r => `<span class="tag tag-kun">${r}</span>`).join('');
        const meanings = (k?.meanings || []).filter(m => !m.toLowerCase().includes('radical'));
        const primaryMeaning = meanings[0] || '';

        body = `
            <div class="kfiche-card">
                <div class="kfiche-center">
                    <div class="kfiche-char">${char}</div>
                    ${primaryMeaning ? `<div class="kfiche-subtext">${primaryMeaning}</div>` : ''}
                    ${meanings.length > 1 ? `<div class="kfiche-subtext kfiche-subtext-secondary">${meanings.slice(1).join(', ')}</div>` : ''}
                </div>
                <div class="kfiche-badges">
                    ${level ? `<span class="kfiche-badge-level">N${level} Niveau</span>` : ''}
                    ${k?.strokes ? `<span class="kfiche-badge-strokes">${k.strokes} Traits</span>` : ''}
                </div>
            </div>
            <div class="kfiche-readings-card">
                ${onTags ? `<div class="kfiche-reading-section"><div class="kfiche-reading-label">ON'YOMI</div><div class="tag-container">${onTags}</div></div>` : ''}
                ${kunTags ? `<div class="kfiche-reading-section"><div class="kfiche-reading-label">KUN'YOMI</div><div class="tag-container">${kunTags}</div></div>` : ''}
                ${(k?.romaji && k.romaji !== '–') ? `<div class="kfiche-reading-section"><div class="kfiche-reading-label">RÔMAJI</div><div class="kfiche-romaji-text">${k.romaji}</div></div>` : ''}
            </div>
        `;
    } else if (entry.type === 'kana') {
        const k = entry.item;
        title = k.char || k.c || '';
        body = `<div class="fiche-sub">${k.romaji || k.r || ''}</div>`;
    }

    return { title, body };
}

function showFicheCorrectionModal(entry) {
    if (!entry) return;
    const typeLabels = {
        vocab: '📚 Vocabulaire', grammar: '📝 Grammaire', kanji: 'Détail du Kanji',
        kana: (entry.level === 'kata') ? 'ア Katakana' : 'あ Hiragana'
    };
    const { title, body } = buildFicheDetailContent(entry);
    const content = document.getElementById('fiche-correction-content');
    if (!content) return;

    content.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;position:relative;margin-bottom:16px">
            <div class="mode-title" style="margin-bottom:0">${typeLabels[entry.type] || ''}</div>
            <button onclick="closeFicheCorrectionModal()" style="position:absolute;right:0;background:none;border:none;color:var(--gray);font-size:22px;cursor:pointer;padding:4px;line-height:1">✕</button>
        </div>
        <div style="text-align:center;padding:8px 0 4px">
            ${title ? `<div style="font-size:2.25rem;font-weight:bold;color:#fff;margin-bottom:8px">${title}</div>` : ''}
            <div style="text-align:left">${body}</div>
        </div>
        <button class="quiz-action-btn primary" style="width:100%;margin-top:18px" onclick="closeFicheCorrectionModal()">Compris ✓</button>
    `;

    const m = document.getElementById('fiche-correction-modal');
    if (!m) return;
    m.classList.add('open');
    m.style.display = 'flex';
}

function closeFicheCorrectionModal() {
    const m = document.getElementById('fiche-correction-modal');
    if (!m) return;
    m.classList.remove('open');
    m.style.display = 'none';
}

function renderMixedReviewScreen() {
    const container = document.getElementById('category-content');
    const session = mixedReviewSession;
    
    if (!session || session.index >= session.queue.length) {
        renderMixedReviewSummary();
        return;
    }
    
    const entry = session.queue[session.index];
    const progress = session.index + 1;
    const total = session.queue.length;
    const flipped = session.flipped;
    
    const { front, back, typeLabel, frontSize } = buildCardDisplay(entry);
    
    container.innerHTML = `<div class="review-page">
        <div class="review-header">
            <button class="back-btn" onclick="history.back()">✕</button>
            <div class="review-progress-bar"><div class="review-progress-fill" style="width:${(session.index / total) * 100}%"></div></div>
            <div class="review-progress-text">${progress} / ${total}</div>
        </div>
        <div class="review-type-tag">${typeLabel}</div>
        <div class="review-card ${flipped ? 'flipped' : ''}" onclick="${flipped ? '' : 'flipMixedReviewCard()'}">
            <div class="review-card-front">
                <div class="review-word" style="font-size:${frontSize}px;">${front}</div>
            </div>
            ${flipped ? `<div class="review-card-back">${back}<button class="fiche-correction-btn" onclick="showFicheCorrectionModal(mixedReviewSession.queue[mixedReviewSession.index])">📖 Voir la fiche</button></div>` : `<div class="review-tap-hint">Touche la carte pour révéler</div>`}
        </div>
        ${flipped ? `
            <div class="review-grade-buttons">
                <button class="grade-btn grade-again" onclick="submitMixedReviewGrade(0)">Encore</button>
                <button class="grade-btn grade-hard" onclick="submitMixedReviewGrade(1)">Difficile</button>
                <button class="grade-btn grade-good" onclick="submitMixedReviewGrade(2)">Bien</button>
                <button class="grade-btn grade-easy" onclick="submitMixedReviewGrade(3)">Facile</button>
            </div>
        ` : ''}
    </div>`;
}

function flipMixedReviewCard() {
    if (!mixedReviewSession) return;
    mixedReviewSession.flipped = true;
    renderMixedReviewScreen();
}

function submitMixedReviewGrade(quality) {
    if (!mixedReviewSession) return;
    const entry = mixedReviewSession.queue[mixedReviewSession.index];
    const id = getEntryTrackingId(entry);
    gradeReview(id, quality, { type: entry.type, label: getEntryLabel(entry) });
    if (quality === 0) scheduleRelearning(mixedReviewSession, entry);
    if (mixedReviewSession.trackDailyQuota && entry.isNew && !entry._dailyCredited) {
        addDailyNewCardsUsed(1);
        entry._dailyCredited = true;
    }
    
    const labels = ['again', 'hard', 'good', 'easy'];
    mixedReviewSession.results[labels[quality]]++;
    
    mixedReviewSession.index++;
    mixedReviewSession.flipped = false;
    renderMixedReviewScreen();
}

function renderMixedReviewSummary() {
    recordSessionCompleted();
    const container = document.getElementById('category-content');
    const r = mixedReviewSession.results;
    const total = mixedReviewSession.queue.length;
    const typesPresent = [...new Set(mixedReviewSession.queue.map(e => e.type))];
    const typeLabels = { vocab: 'vocab', grammar: 'grammaire', kanji: 'kanji', kana: 'kana' };
    const typesText = typesPresent.map(t => typeLabels[t] || t).join(' + ');
    
    container.innerHTML = `<div class="review-summary">
        <div class="review-summary-title">Session terminée ! 🎉</div>
        <div class="review-summary-count">${total} carte${total > 1 ? 's' : ''} révisée${total > 1 ? 's' : ''}${typesText ? ` (${typesText})` : ''}</div>
        <div class="review-summary-stats">
            <div class="review-stat"><span class="review-stat-dot again"></span>Encore : ${r.again}</div>
            <div class="review-stat"><span class="review-stat-dot hard"></span>Difficile : ${r.hard}</div>
            <div class="review-stat"><span class="review-stat-dot good"></span>Bien : ${r.good}</div>
            <div class="review-stat"><span class="review-stat-dot easy"></span>Facile : ${r.easy}</div>
        </div>
        <button class="revise-btn" style="margin-top:20px;" onclick="history.back()">Retour</button>
    </div>`;
    mixedReviewSession = null;
}

/* ── PAGE CATÉGORIE (Version épurée) ────────────────── */

function loadCategory(catId, isBack = false) {
    const cat = categories.get(catId);
    if (!cat) return;
    
    // Enregistrement de l'état
    if (!isBack) history.pushState({ view: 'category', id: catId }, '');

    currentCatId = catId;
    document.getElementById('page-title').innerText = cat.label;
    const catSeries = [...seriesMap.values()].filter(s => s.catId === catId);

    const seriesCards = catSeries.map(ser => {
        const firstKanji = kanjiDb[ser.indices[0]]?.char ?? '？';
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

/* ── PAGE SÉRIE (Avec Bouton Retour) ──────────────── */
function loadSeriesPage(seriesId, isBack = false) {
    const ser = seriesMap.get(seriesId);
    if (!ser) return;

    // Enregistrement de l'état
    if (!isBack) history.pushState({ view: 'series', id: seriesId }, '');

    const cat = categories.get(ser.catId);
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

function makeKanjiRow(k) {
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
   MODAL SÉLECTION DE MODE QUIZ
══════════════════════════════════════════════════ */
let _quizModalSource = { type: null, id: null };

function showQuizModeModal(sourceType, sourceId) {
    _quizModalSource = { type: sourceType, id: sourceId };
    const m = document.getElementById('quiz-mode-modal');
    m.classList.add('open');
    m.style.display = 'flex';
}

function closeQuizModal() {
    const m = document.getElementById('quiz-mode-modal');
    m.classList.remove('open');
    m.style.display = 'none';
}

function launchQuizMode(mode) {
    closeQuizModal();
    // Si on vient de la fiche kanji, la fermer d'abord
    if (_quizModalSource.type === 'single') closeDetail();
    startQuiz({ type: _quizModalSource.type, id: _quizModalSource.id, mode });
}

function launchStrokeMode(mode) {
    closeQuizModal();
    if (_quizModalSource.type === 'single') closeDetail();
    startStrokeQuiz({ type: _quizModalSource.type, id: _quizModalSource.id, mode });
}

/* ══════════════════════════════════════════════════
   QUIZ VOCAL — startVoiceRecognition()
   Appelé depuis le prompt du mode vocal dans renderQuizQuestion
══════════════════════════════════════════════════ */
let _vocalRecognition = null;
let _vocalListening   = false;

/* ════════════════════════════════════════════════════
   startVoiceRecognition(autoStart)
   ─────────────────────────────────────────────────
   Corrections :
   • Prend la transcription à PLUS HAUTE CONFIDENCE
   • onspeechend → stop propre avant onend
   • Abort sécurisé avec délai 100ms avant nouvelle instance
   • null-checks sur tous les éléments DOM
   • Comparaison élargie : exact, préfixe, forme courte/longue
   • Auto-start en mode survie (autoStart=true)
════════════════════════════════════════════════════ */
function startVoiceRecognition(autoStart = false) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        const fb = document.getElementById('vocal-feedback');
        if (fb) { fb.style.color = '#e55'; fb.textContent = 'Micro non supporté sur ce navigateur.'; }
        return;
    }
    if (_vocalListening) return;

    if (!quizState) return;
    const k = kanjiDb[quizState.indices[quizState.idx]];
    const validReadings = getAllValidReadings(k);
    const bestRead      = getBestReading(k);

    // On réutilise les fonctions partagées normalizeOralResult + isResultCorrect
    // qui gèrent : chiffres arabes ("8"→"はち"), kanji+okurigana ("入る"), katakana, etc.
    const matches = (said) => {
        if (!said) return false;
        // Tester d'abord isResultCorrect (gère tous les cas complexes)
        if (isResultCorrect(said, k.char, k)) return true;
        // Fallback : comparaison souple sur le normalisé (startsWith pour les formes longues)
        const ns = normalizeOralResult(said);
        return validReadings.some(r => {
            const nr = toHira(r.replace(/[.·＊*\-].*/, '').replace(/^!/, '').trim());
            return nr && (nr === ns || ns.startsWith(nr) || nr.startsWith(ns));
        });
    };

    // Abort sécurisé : nullifier d'abord, aborter ensuite
    const oldRec = _vocalRecognition;
    _vocalRecognition = null;
    if (oldRec) { try { oldRec.abort(); } catch(e){} }

    const doStart = () => {
        const micBtn = document.getElementById('mic-btn');
        const fb     = document.getElementById('vocal-feedback');
        if (!micBtn) return; // question déjà changée

        const rec = new SR();
        _vocalRecognition = rec;
        _vocalListening   = true;

        rec.lang            = 'ja-JP';
        rec.continuous      = false;
        rec.interimResults  = false;
        rec.maxAlternatives = 5;

        rec.onstart = () => {
            const btn = document.getElementById('mic-btn');
            const f   = document.getElementById('vocal-feedback');
            if (btn) btn.classList.add('listening');
            if (f)   { f.style.color = 'var(--gray)'; f.textContent = 'Écoute en cours… parlez maintenant'; }
        };

        rec.onspeechend = () => { try { rec.stop(); } catch(e){} };

        rec.onresult = (ev) => {
            // Transcription à la PLUS HAUTE CONFIANCE
            let bestSaid = '', bestConf = -1;
            const result = ev.results[0];
            for (let i = 0; i < result.length; i++) {
                const alt = result[i];
                if (alt.confidence > bestConf) { bestConf = alt.confidence; bestSaid = alt.transcript.trim(); }
            }
            if (!bestSaid && result.length > 0) bestSaid = result[0].transcript.trim();

            const isCorrect = matches(bestSaid);

            const btn2 = document.getElementById('mic-btn');
            const fb2  = document.getElementById('vocal-feedback');
            if (btn2) btn2.classList.remove('listening');
            if (fb2) {
                if (isCorrect) {
                    fb2.style.color = 'var(--accent)';
                    fb2.textContent = `✔ Correct ! « ${bestSaid} »`;
                } else {
                    const alts = validReadings.filter(r => r !== bestRead).slice(0, 2).join(', ');
                    fb2.style.color = '#e55';
                    fb2.textContent = `✘ « ${bestSaid || '(rien)'} »  –  Attendu : ${bestRead}${alts ? '  (ou ' + alts + ')' : ''}`;
                }
            }

            if (!quizState || quizState.answered) return;
            quizState.answered = true;
            if (isCorrect) {
                quizState.correct++;
                const oc = document.getElementById('quiz-correct');
                if (oc) oc.textContent = quizState.correct;
            } else {
                quizState.wrong++;
                const ow = document.getElementById('quiz-wrong');
                if (ow) ow.textContent = quizState.wrong;
            }
            const next = quizState.idx + 1;
            const scoreEl = document.getElementById('quiz-score-sub');
            if (scoreEl) scoreEl.textContent = `${(quizState.correct / next * 10).toFixed(1)} / 10.0`;

            if (isCorrect) {
                setTimeout(() => { if (quizState) { quizState.idx++; renderQuizQuestion(); } }, 1000);
            } else {
                // Laisser réessayer après 2s
                setTimeout(() => {
                    if (!quizState) return;
                    quizState.answered = false;
                    _vocalListening = false;
                    const btn3 = document.getElementById('mic-btn');
                    const fb3  = document.getElementById('vocal-feedback');
                    if (btn3 && fb3) { fb3.style.color = 'var(--gray)'; fb3.textContent = 'Réessayez ou → pour passer'; }
                }, 2000);
            }
        };

        rec.onerror = (ev) => {
            _vocalListening = false;
            const btn = document.getElementById('mic-btn');
            const f   = document.getElementById('vocal-feedback');
            if (btn) btn.classList.remove('listening');
            if (f) {
                const msg = ev.error === 'no-speech'   ? 'Aucune voix détectée — réessayez'
                          : ev.error === 'not-allowed' ? 'Accès micro refusé (vérifiez les permissions)'
                          : 'Erreur : ' + ev.error;
                f.style.color = '#e55'; f.textContent = msg;
            }
        };

        rec.onend = () => {
            _vocalListening = false;
            const btn = document.getElementById('mic-btn');
            if (btn) btn.classList.remove('listening');
        };

        try { rec.start(); }
        catch(e) {
            _vocalListening = false;
            const f = document.getElementById('vocal-feedback');
            if (f) { f.style.color = '#e55'; f.textContent = 'Impossible de démarrer le micro : ' + e.message; }
        }
    };

    setTimeout(doStart, oldRec ? 100 : 0);
}


/* ══════════════════════════════════════════════════
   QUIZ — API FLEXIBLE
   startQuiz({ type: "category", id: "p1" })
   startQuiz({ type: "series",   id: "p1_s1" })
══════════════════════════════════════════════════ */
let quizTimerInterval = null;
let quizPaused = false;

function startQuiz({ type, id, mode = 'kanji-to-read' }) {
    let indices, title, poolIndices;

    if (type === 'category') {
        const cat = categories.get(id);
        if (!cat || !cat.indices.length) return;
        indices = shuffleIndices([...cat.indices]);
        poolIndices = [...cat.indices];
        title = cat.label;
    } else if (type === 'series') {
        const ser = seriesMap.get(id);
        if (!ser || !ser.indices.length) return;
        const cat = categories.get(ser.catId);
        indices = shuffleIndices([...ser.indices]);
        poolIndices = [...(cat?.indices ?? ser.indices)];
        title = `${cat?.label ?? ''} · ${ser.label}`;
    } else if (type === 'single') {
        // Un seul kanji — depuis la fiche détail
        const idx = kanjiMap.get(id);
        if (idx === undefined) return;
        indices = [idx];
        // Pool = toute la catégorie du kanji pour les leurres
        const cat = [...categories.values()].find(c => c.indices.includes(idx));
        poolIndices = cat ? [...cat.indices] : [...Array(kanjiDb.length).keys()];
        title = `Entraînement : ${id}`;
    } else { return; }

    if (quizTimerInterval) clearInterval(quizTimerInterval);
    quizPaused = false;
    pushModalState('quiz');

    // On ajoute le MODE ici
    quizState = {
        indices, poolIndices, idx: 0,
        correct: 0, wrong: 0,
        answered: false, revealed: false,
        title, sourceType: type, sourceId: id,
        elapsedSec: 0,
        mode: mode // <--- IMPORTANT : On stocke le mode choisi
    };

    document.getElementById('quiz-correct').textContent = '0';
    document.getElementById('quiz-wrong').textContent = '0';
    document.getElementById('quiz-timer').textContent = '0:00';
    document.getElementById('quiz-view').style.display = 'flex';

    quizTimerInterval = setInterval(() => {
        if (!quizPaused && quizState) {
            quizState.elapsedSec++;
            const m = Math.floor(quizState.elapsedSec / 60);
            const s = quizState.elapsedSec % 60;
            document.getElementById('quiz-timer').textContent = `${m}:${String(s).padStart(2,'0')}`;
        }
    }, 1000);

    renderQuizQuestion();
}

function closeQuiz() {
    if (quizTimerInterval) { clearInterval(quizTimerInterval); quizTimerInterval = null; }
    // Stopper la reconnaissance vocale si active
    if (_vocalRecognition) { try { _vocalRecognition.abort(); } catch(e){} _vocalRecognition = null; }
    _vocalListening = false;
    document.getElementById('quiz-view').style.display = 'none';
    quizState = null;
    quizPaused = false;
}

// Passer une question vocale (compté comme erreur)
function skipVocalQuestion() {
    if (!quizState || quizState.answered) return;
    if (_vocalRecognition) { try { _vocalRecognition.abort(); } catch(e){} _vocalRecognition = null; }
    _vocalListening = false;
    quizState.answered = true;
    quizState.wrong++;
    const ow = document.getElementById('quiz-wrong');
    if (ow) ow.textContent = quizState.wrong;
    const next = quizState.idx + 1;
    const scoreEl = document.getElementById('quiz-score-sub');
    if (scoreEl) scoreEl.textContent = `${(quizState.correct / next * 10).toFixed(1)} / 10.0`;
    setTimeout(() => { if (quizState) { quizState.idx++; renderQuizQuestion(); } }, 300);
}

function togglePause() {
    quizPaused = !quizPaused;
    document.querySelector('.quiz-pause-btn').textContent = quizPaused ? '▶' : '⏸';
}

/* ─────────────────────────────────────────────────
   PHASE 1 — Affichage lectures + sens (sans kanji)
───────────────────────────────────────────────── */
function renderQuizQuestion() {
    if (!quizState || quizState.idx >= quizState.indices.length) { renderQuizResults(); return; }

    const qs = quizState;
    const k = kanjiDb[qs.indices[qs.idx]];
    
    let currentMode = qs.mode;
    if (qs.mode === 'survie') {
        currentMode = ['kanji-to-read', 'kanji-to-mean', 'read-to-kanji', 'mean-to-kanji', 'vocal'][Math.floor(Math.random() * 5)];
    } else if (qs.mode === 'mixte') {
        currentMode = ['kanji-to-read', 'kanji-to-mean'][Math.floor(Math.random() * 2)];
    }

    document.getElementById('quiz-prog-bar').style.width = (qs.idx / qs.indices.length * 100).toFixed(1) + '%';
    document.getElementById('quiz-counter-sub').textContent = `${qs.idx + 1} / ${qs.indices.length}`;
    
    qs.answered = false;
    qs.revealed = false;

    const bestRead = getBestReading(k);
    const meaning = k.meanings.filter(m => !m.toLowerCase().includes('radical')).slice(0,2).join(' • ');

    let promptHtml = "";
    
    if (currentMode === 'vocal') {
        const vMeaning = k.meanings.filter(m => !m.toLowerCase().includes('radical')).slice(0,2).join(' · ') || k.meanings[0] || '?';
        const vChips   = buildReadingChips(k, { maxOn: 3, maxKun: 3, showBadge: true });
        promptHtml = `
            <div style="font-size:0.6875rem;color:var(--gray);text-transform:uppercase;letter-spacing:1px;margin-bottom:14px">Sens affiché — Prononcez la lecture</div>
            <div class="quiz-meaning-big" style="font-size:1.875rem;font-weight:bold;margin-bottom:12px;">${vMeaning}</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:18px;opacity:0.45"
                 title="Lectures possibles (aide — masquée volontairement)">${vChips}</div>
            <button id="mic-btn" class="mic-btn" onclick="startVoiceRecognition()" title="Appuyer pour parler">🎤</button>
            <div id="vocal-feedback" style="font-size:0.8125rem;color:var(--gray);margin-top:16px;min-height:22px;text-align:center;max-width:300px;line-height:1.5;"></div>
            <button onclick="skipVocalQuestion()" style="margin-top:18px;background:none;border:1px solid var(--border);color:var(--gray);padding:8px 20px;border-radius:8px;font-size:0.75rem;cursor:pointer;font-family:inherit;">→ Passer</button>`;
    } else if (currentMode === 'kanji-to-read' || currentMode === 'kanji-to-mean') {
        // REMPLACÉ PAR LE CONTENEUR ANIMÉ
        promptHtml = `
            <div id="quiz-kanji-animated" class="quiz-kanji-animated"></div>
            <div class="quiz-tap-hint">Trouvez la bonne réponse</div>`;
    } else if (currentMode === 'read-to-kanji') {
        promptHtml = `
            <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:14px">
                ${buildReadingChips(k, { maxOn: 4, maxKun: 4, showBadge: true })}
            </div>
            <div class="quiz-tap-hint">Quel est le kanji correspondant ?</div>`;
    } else if (currentMode === 'mean-to-kanji') {
        promptHtml = `<div class="quiz-meaning-big">${meaning}</div>
                      <div class="quiz-tap-hint">Quel est le kanji correspondant ?</div>`;
    }

    const clickAttr = currentMode !== 'vocal' ? `onclick="revealChoices('${currentMode}')"` : "";

    document.getElementById('quiz-body').innerHTML = `
        <div class="quiz-prompt-wrap" id="quiz-prompt" ${clickAttr}>
            ${promptHtml}
            <div class="quiz-choices-grid" id="quiz-choices" style="display:none"></div>
        </div>`;


// --- INITIALISATION HANZIWRITER ---
if (currentMode === 'kanji-to-read' || currentMode === 'kanji-to-mean') {
    setTimeout(() => {
        const targetId = 'quiz-kanji-animated';
        const targetDiv = document.getElementById(targetId);
        
        if (!targetDiv) {
            console.error(`La div #${targetId} est introuvable dans le DOM.`);
            return;
        }

        // 1. On vide la div pour éviter les conflits d'anciennes animations
        targetDiv.innerHTML = '';

        // 2. On sécurise le caractère (on s'assure qu'on a bien une chaîne propre)
        const charToDraw = String(k.char).trim();

        const writer = HanziWriter.create(targetId, charToDraw, {
            width: 160,
            height: 160,
            padding: 5,
            strokeAnimationSpeed: 1,
            delayBetweenStrokes: 200,
            strokeColor:  '#00c9a7',
            outlineColor: '#18181f',   // = --surface, fond exact du writer-main
            charColor:    '#18181f',   // idem : traits non-animés invisibles sur fond
            showOutline: true,
            // L'outil de chargement blindé contre les bugs d'encodage
            charDataLoader: kanjiDataLoader,
            onLoadCharDataError: () => {
                if (targetDiv) targetDiv.innerHTML =
                    `<div style="font-size:5.625rem;line-height:160px;text-align:center;color:#fff">${charToDraw}</div>`;
            }
        });
        
        writer.animateCharacter();
    }, 50);
}

    // --- AUTO-START MICRO en mode vocal ---
    // Délai de 650ms pour laisser le DOM se stabiliser et l'utilisateur lire le sens
    if (currentMode === 'vocal') {
        _vocalListening = false; // reset au cas où une session précédente traînerait
        setTimeout(() => {
            if (quizState && !quizState.answered) startVoiceRecognition(true);
        }, 650);
    }
}

/* ─────────────────────────────────────────────────
   PHASE 2 — Révélation des 6 kanjis (tap)
───────────────────────────────────────────────── */
function revealChoices(currentMode) {
    if (!quizState || quizState.revealed) return;
    quizState.revealed = true;

    const qs = quizState;
    const kIdx = qs.indices[qs.idx];
    const decoys = pickDecoyIndices(kIdx, kanjiDb[kIdx].meanings[0], 5, qs.poolIndices);
    const choices = shuffleIndices([kIdx, ...decoys]);

    const grid = document.getElementById('quiz-choices');
    grid.style.display = 'grid';
    if (currentMode === 'kanji-to-read') {
        grid.classList.add('chip-mode');
    } else {
        grid.classList.remove('chip-mode');
    }
    
    grid.innerHTML = choices.map(ci => {
        const target = kanjiDb[ci];
        let content = "";

        if (currentMode === 'kanji-to-read') {
            // Toutes les lectures ON + KUN en chips compactes (max 3+3)
            content = `<div style="display:flex;flex-wrap:wrap;gap:3px;justify-content:center;align-items:flex-start;width:100%">
                ${buildReadingChips(target, { maxOn: 3, maxKun: 3, showBadge: true, chipStyle: 'padding:3px 6px;font-size:0.75rem;min-width:0' })}
            </div>`;
        } else if (currentMode === 'kanji-to-mean') {
            content = target.meanings.filter(m => !m.toLowerCase().includes('radical'))[0] || target.meanings[0] || '?';
        } else if (currentMode === 'read-to-kanji' || currentMode === 'mean-to-kanji') {
            content = target.char;
        } else {
            content = target.char;
        }

        const fontSize = (currentMode === 'read-to-kanji' || currentMode === 'mean-to-kanji') ? '36px' : '14px';
        const isChipMode = currentMode === 'kanji-to-read';

        return `<div class="quiz-kanji-choice" data-idx="${ci}" onclick="answerQuiz(this,${ci},${kIdx})"
            style="${isChipMode ? 'font-size:0.875rem;align-items:center' : `font-size:${content.length > 8 ? '18px' : fontSize}`}">
            ${content}
        </div>`;
    }).join('');

    document.querySelectorAll('.quiz-tap-hint').forEach(h => h.style.display = 'none');
}

function toggleExamples() { /* placeholder pour une future expansion */ }

/* ─────────────────────────────────────────────────
   RÉPONSE
───────────────────────────────────────────────── */
let _qfmPending = null; // callback exécuté au clic "Continuer"

function showQuizFeedbackModal(k, isCorrect, onContinue) {
    _qfmPending = onContinue;

    const card = document.getElementById('qfm-card');
    card.classList.remove('correct', 'wrong');
    card.classList.add(isCorrect ? 'correct' : 'wrong');

    document.getElementById('qfm-kanji').textContent = k.char;

    const meanings = k.meanings.filter(m => !m.toLowerCase().includes('radical'));
    document.getElementById('qfm-meaning').textContent =
        (meanings.length ? meanings : k.meanings).slice(0, 3).join(' · ') || '–';

    const cleanReading = r => r.replace(/[.·＊*].*/, '').replace(/-.*/, '').replace(/^!/, '').trim();
    const seenOn = new Set(), seenKun = new Set();

    const onTags = (k.on || [])
        .map(cleanReading).filter(r => r && !seenOn.has(r) && seenOn.add(r))
        .map(r => `<span class="tag tag-on">${toKata(r)}</span>`).join('');
    const kunTags = (k.kun || [])
        .map(cleanReading).filter(r => r && !seenKun.has(r) && seenKun.add(r))
        .map(r => `<span class="tag tag-kun">${toHira(r)}</span>`).join('');

    document.getElementById('qfm-on').innerHTML  = onTags  || '<span class="tag-empty">Aucune</span>';
    document.getElementById('qfm-kun').innerHTML = kunTags || '<span class="tag-empty">Aucune</span>';

    document.getElementById('qfm-verdict').textContent =
        isCorrect ? '✔ Bonne réponse !' : `✘ Réponse correcte : ${k.char}`;

    document.getElementById('quiz-feedback-modal').classList.add('open');
}

function continueAfterFeedback() {
    document.getElementById('quiz-feedback-modal').classList.remove('open');
    const cb = _qfmPending;
    _qfmPending = null;
    if (cb) cb();
}

function answerQuiz(btn, chosenIdx, correctIdx) {
    if (!quizState || quizState.answered) return;
    quizState.answered = true;

    const isCorrect = chosenIdx === correctIdx;
    if (isCorrect) {
        btn.classList.add('correct');
        quizState.correct++;
        document.getElementById('quiz-correct').textContent = quizState.correct;
    } else {
        btn.classList.add('wrong');
        quizState.wrong++;
        document.getElementById('quiz-wrong').textContent = quizState.wrong;
    }

    // Révéler la bonne réponse sur toutes les cellules
    document.querySelectorAll('.quiz-kanji-choice').forEach(b => {
        b.classList.add('locked');
        if (parseInt(b.dataset.idx) === correctIdx && !b.classList.contains('correct')) {
            b.classList.add('reveal');
        }
    });

    // Mise à jour score flottant
    const next = quizState.idx + 1;
    const scoreFloat = (quizState.correct / next * 10).toFixed(1);
    document.getElementById('quiz-score-sub').textContent = `${scoreFloat} / 10.0`;

// APRÈS :
const correctKanji = kanjiDb[correctIdx];
setTimeout(() => {
    showQuizFeedbackModal(correctKanji, isCorrect, () => {
        if (quizState) { quizState.idx++; renderQuizQuestion(); }
    });
}, isCorrect ? 400 : 700);
}

function renderQuizResults() {
    if (quizTimerInterval) { clearInterval(quizTimerInterval); quizTimerInterval = null; }
    if (!quizState) return;
    document.getElementById('quiz-prog-bar').style.width = '100%';
    document.getElementById('quiz-examples-btn').style.display = 'none';

    const { correct, indices, sourceType, sourceId, elapsedSec } = quizState;
    const total   = indices.length;
    const wrong   = total - correct;
    const pct     = Math.round(correct / total * 100);
    const emoji   = pct >= 80 ? '🎉' : pct >= 60 ? '👍' : pct >= 40 ? '💪' : '😅';
    const msg     = pct >= 80 ? 'Excellent !' : pct >= 60 ? 'Bien joué !' : pct >= 40 ? 'Continuez !' : 'À réviser…';
    const m = Math.floor(elapsedSec / 60), s = elapsedSec % 60;
    const timeStr = `${m}:${String(s).padStart(2,'0')}`;
    
    // Save quiz scores to localStorage for each kanji
    indices.forEach(idx => {
        const kanji = kanjiDb[idx];
        if (kanji) {
            localStorage.setItem(`quiz_${kanji.char}`, pct);
        }
    });

    document.getElementById('quiz-body').innerHTML = `
        <div class="quiz-results">
            <div class="quiz-results-emoji">${emoji}</div>
            <div class="quiz-score-big">${pct}%</div>
            <div class="quiz-score-label">${msg}</div>
            <div class="quiz-breakdown">
                <div class="quiz-breakdown-row"><span>✔ Corrects</span><strong style="color:var(--accent)">${correct}</strong></div>
                <div class="quiz-breakdown-row"><span>✘ Erreurs</span><strong style="color:#e55">${wrong}</strong></div>
                <div class="quiz-breakdown-row"><span>Total</span><strong>${total}</strong></div>
                <div class="quiz-breakdown-row"><span>Temps</span><strong>${timeStr}</strong></div>
            </div>
            <div class="quiz-btn-row">
                <button class="quiz-action-btn secondary" onclick="history.back()">Fermer</button>
                <button class="quiz-action-btn primary"
                    onclick="startQuiz({type:'${sourceType}',id:'${sourceId}'})">Rejouer ↺</button>
            </div>
        </div>`;
}

/* ══════════════════════════════════════════════════
   QUIZ DE TRACÉ (Stroke Order Quiz) - VERSION OPTIMISÉE
   ───────────────────────────────────────────────── */
let strokeQuizState  = null;
let strokeWriter     = null;
let sqTimerInterval  = null;
let sqPaused         = false;

/**
 * Enregistre un Kanji réussi sans faute dans le localStorage
 */
function markMastered(character) {
    localStorage.setItem('mastered_' + character, 'true');
    console.log(`🎯 Kanji ${character} marqué comme maîtrisé !`);
}

/**
 * Initialise le moteur de tracé selon le mode
 */
function createStrokeWriter(elementId, character, isHardcore, loaderOptions = {}) {
    const el = document.getElementById(elementId);
    if (!el) return null;

    if (typeof HanziWriter === 'undefined') {
        console.warn("[Kanji Learner] HanziWriter indisponible pour createStrokeWriter, attente...");
        setTimeout(() => createStrokeWriter(elementId, character, isHardcore, loaderOptions), 150);
        return null;
    }

    // dataLoader/onDataError/dimensions personnalisables (ex: tracé kana yōon) — comportement kanji inchangé par défaut
    const { dataLoader = kanjiDataLoader, onDataError = sqSkip, width = 280, height = 280, padding = 24 } = loaderOptions;

    // 1. Définition des options de base (communes aux deux modes)
    const baseOptions = {
        width, height, padding,
        drawingWidth:     8,
        // renderer canvas par défaut (fiable pour le tracé tactile mobile)
        charDataLoader: dataLoader,
        onLoadCharDataError: () => {
            console.warn('HanziWriter: données manquantes pour', character);
            setTimeout(() => {
                const fb = document.getElementById('sq-feedback');
                if (fb) { fb.style.color = '#f5a623'; fb.textContent = `Données manquantes pour ${character} — passage automatique`; }
                setTimeout(onDataError, 1200);
            }, 300);
        }
    };

    // 2. Configuration spécifique selon le mode
    if (isHardcore) {
        return HanziWriter.create(elementId, character, {
            ...baseOptions,
            showCharacter:       false, 
            
            // 🎯 LE SECRET EST LÀ : On dit au moteur de ne pas dessiner le contour.
            // Le quiz marchera parfaitement en arrière-plan avec les données JSON !
            showOutline:         false, 
            
            strokeColor:         '#00c9a7', // Ton trait et tes succès seront bien verts
            drawingColor:        '#00c9a7',
            highlightOnComplete: false,     
            showHintAfterMisses: 4,     
        });
    } else {
        return HanziWriter.create(elementId, character, {
            ...baseOptions,
            showCharacter:       false,
            showOutline:         true,
            outlineColor:        '#88899E',   // guide vert comme les traits réussis
            outlineOpacity:      0.15,        // très discret, juste visible comme guide
            strokeColor:         '#00c9a7',
            drawingColor:        '#00c9a7',
            highlightOnComplete: true,
            showHintAfterMisses: 2,
        });
    }
}

function startStrokeQuiz({ type, id, mode = 'trace-easy' }) {
    let indices, title;
    if (type === 'category') {
        const cat = categories.get(id);
        if (!cat || !cat.indices.length) return;
        indices = shuffleIndices([...cat.indices]);
        title = cat.label;
    } else if (type === 'series') {
        const ser = seriesMap.get(id);
        if (!ser || !ser.indices.length) return;
        const cat = categories.get(ser.catId);
        indices = shuffleIndices([...ser.indices]);
        title = `${cat?.label ?? ''} · ${ser.label}`;
    } else if (type === 'single') {
        const kanji = kanjiDb.find(k => k.char === id);
        if (!kanji) return;
        indices = [kanjiDb.indexOf(kanji)];
        title = `Pratique : ${kanji.char}`;
    } else if (type === 'queue') {
        // id est ici un tableau de caractères (file de révision SRS)
        indices = id.map(char => kanjiDb.findIndex(k => k.char === char)).filter(i => i !== -1);
        if (indices.length === 0) return;
        title = 'Révision';
    } else { return; }

    if (sqTimerInterval) clearInterval(sqTimerInterval);
    sqPaused = false;

    strokeQuizState = {
        indices, idx: 0,
        correct: 0, wrong: 0,
        title, sourceType: type, sourceId: id,
        elapsedSec: 0,
        mistakesThisKanji: 0,
        mode: mode 
    };

    document.getElementById('sq-correct').textContent = '0';
    document.getElementById('sq-wrong').textContent = '0';
    document.getElementById('sq-timer').textContent = '0:00';
    document.getElementById('stroke-quiz-view').style.display = 'flex';

    sqTimerInterval = setInterval(() => {
        if (!sqPaused && strokeQuizState) {
            strokeQuizState.elapsedSec++;
            const m = Math.floor(strokeQuizState.elapsedSec / 60);
            const s = strokeQuizState.elapsedSec % 60;
            document.getElementById('sq-timer').textContent = `${m}:${String(s).padStart(2,'0')}`;
        }
    }, 1000);

    renderStrokeQuizQuestion();
}

function renderStrokeQuizQuestion() {
    if (!strokeQuizState) return;
    const qs = strokeQuizState;
    if (qs.idx >= qs.indices.length) { renderStrokeQuizResults(); return; }

    // Annuler les timers et nettoyer l'ancien writer AVANT de réécrire le DOM
    if (qs._nextTimer) { clearTimeout(qs._nextTimer); qs._nextTimer = null; }
    if (strokeWriter) { try { strokeWriter.cancelQuiz(); } catch(_) {} strokeWriter = null; }

    const k          = kanjiDb[qs.indices[qs.idx]];
    const isHardcore = (qs.mode === 'trace-hard');

    document.getElementById('sq-prog-bar').style.width = (qs.idx / qs.indices.length * 100).toFixed(1) + '%';
    document.getElementById('sq-counter').textContent  = `${qs.idx + 1} / ${qs.indices.length}`;
    updateSqScore();
    qs.mistakesThisKanji = 0;

    const meanings      = k.meanings.filter(m => !m.toLowerCase().includes('radical'));
    const mainMeaning   = meanings.length ? meanings[0] : (k.meanings[0] || '?');
    const extraMeanings = meanings.slice(1, 3);

    const extraHtml = extraMeanings.length
        ? `<div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin-top:4px">
            ${extraMeanings.map(m => `<span style="font-size:0.6875rem;color:var(--gray);background:var(--card);border:1px solid var(--border);border-radius:5px;padding:2px 8px">${m}</span>`).join('')}
           </div>` : '';

    const readingsChips = buildReadingChips(k, { maxOn: 4, maxKun: 4, showBadge: true });
    const strokeDots    = Array(k.strokes).fill(0).map((_, i) =>
        `<div class="sq-stroke-dot" id="sq-dot-${i}"></div>`).join('');

    document.getElementById('stroke-quiz-body').innerHTML = `
        <div class="sq-kanji-header">
            <div class="sq-meaning" style="font-size:1.375rem;font-weight:bold">${mainMeaning}</div>
            ${extraHtml}
            <div class="sq-readings-row" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;justify-content:center">
                ${readingsChips}
            </div>
        </div>
        <div class="sq-canvas-wrap" id="sq-canvas-wrap" style="touch-action:none;">
            <div id="sq-writer-target"></div>
            <div class="sq-grid-overlay"></div>
        </div>
        <div class="sq-stroke-tracker" id="sq-stroke-tracker">${strokeDots}</div>
        <div id="sq-feedback" style="height:22px;margin-top:10px;font-weight:bold;text-align:center;font-size:0.8125rem;color:var(--gray)"></div>
        <div class="sq-actions">
            <button class="sq-btn hint" onclick="sqShowHint()">💡 Indice</button>
            <button class="sq-btn skip" onclick="sqSkip()">Passer →</button>
        </div>`;

    // Attendre le prochain frame pour que le DOM soit stabilisé
    // avant d'initialiser HanziWriter (évite le bug "élément invisible")
    requestAnimationFrame(() => {
        if (!strokeQuizState || strokeQuizState.idx !== qs.idx) return;

        strokeWriter = createStrokeWriter('sq-writer-target', k.char, isHardcore);
        if (!strokeWriter) { sqSkip(); return; }

        const sqBody = document.getElementById('stroke-quiz-body');
        if (sqBody) sqBody.classList.add('tracing');

        // Attendre que HanziWriter ait créé son SVG (asynchrone)
        // puis poser touch-action:none et bloquer le scroll sans toucher aux pointer events
        requestAnimationFrame(() => {
            const target = document.getElementById('sq-writer-target');
            if (!target) return;
            target.style.touchAction = 'none';
            target.querySelectorAll('*').forEach(el => { el.style.touchAction = 'none'; });

            // Bloquer scroll uniquement sur touchmove (pas touchstart ni touchend)
            // touchstart bloqué = certains navigateurs ne génèrent plus pointerdown
            // touchend bloqué = pointerup n'est plus généré → onComplete ne fire jamais
            target.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
        });

        let strokesDone = 0;
        let lastStrokeTimer = null;
        let _quizCompleted = false;

        const triggerComplete = (totalMistakes) => {
            if (_quizCompleted) return;
            _quizCompleted = true;
            if (lastStrokeTimer) { clearTimeout(lastStrokeTimer); lastStrokeTimer = null; }
            if (!strokeQuizState) return;

            const sqBody = document.getElementById('stroke-quiz-body');
            if (sqBody) sqBody.classList.remove('tracing');

            const totalErrors = (totalMistakes != null) ? totalMistakes : qs.mistakesThisKanji;
            const isClean = totalErrors === 0;

            if (isClean) { qs.correct++; document.getElementById('sq-correct').textContent = qs.correct; }
            else         { qs.wrong++;   document.getElementById('sq-wrong').textContent   = qs.wrong; }
            updateSqScore();
            if (isClean) markMastered(k.char);

            const fb = document.getElementById('sq-feedback');
            if (fb) {
                fb.style.color = isClean ? 'var(--accent)' : '#e55';
                fb.textContent = isClean ? '✔ Parfait !' : `Terminé — ${totalErrors} erreur${totalErrors > 1 ? 's' : ''}`;
            }
            qs._nextTimer = setTimeout(() => {
                qs._nextTimer = null;
                if (!strokeQuizState) return;
                strokeQuizState.idx++;
                renderStrokeQuizQuestion();
            }, 1100);
        };

        // Callbacks stockés dans qs._quizCallbacks pour être réutilisés
        // par sqShowHint() lors du redémarrage du quiz après un indice
        const quizCallbacks = {
            onMistake() {
                qs.mistakesThisKanji++;
                const dot = document.getElementById(`sq-dot-${strokesDone}`);
                if (dot) { dot.classList.add('mistake'); setTimeout(() => dot.classList.remove('mistake'), 400); }
                const wrap = document.getElementById('sq-canvas-wrap');
                if (wrap) { wrap.classList.add('flash-err'); setTimeout(() => wrap.classList.remove('flash-err'), 350); }
                const fb = document.getElementById('sq-feedback');
                if (fb) { fb.style.color = '#e55'; fb.textContent = isHardcore ? 'Mauvais tracé !' : 'Mauvais tracé, regarde l\'aide…'; }
            },
            onCorrectStroke() {
                const dot = document.getElementById(`sq-dot-${strokesDone}`);
                if (dot) dot.classList.add('done');
                strokesDone++;
                const wrap = document.getElementById('sq-canvas-wrap');
                if (wrap) { wrap.classList.add('flash-ok'); setTimeout(() => wrap.classList.remove('flash-ok'), 350); }
                const fb = document.getElementById('sq-feedback');
                if (fb) { fb.style.color = 'var(--accent)'; fb.textContent = 'Bien !';
                    setTimeout(() => { if (fb && fb.textContent === 'Bien !') fb.textContent = ''; }, 800); }

                if (strokesDone >= k.strokes) {
                    if (lastStrokeTimer) clearTimeout(lastStrokeTimer);
                    lastStrokeTimer = setTimeout(() => {
                        lastStrokeTimer = null;
                        triggerComplete(qs.mistakesThisKanji);
                    }, 700);
                }
            },
            onComplete(summary) {
                const totalMistakes = (summary && typeof summary.totalMistakes !== 'undefined')
                    ? summary.totalMistakes : qs.mistakesThisKanji;
                triggerComplete(totalMistakes);
            }
        };
        qs._quizCallbacks  = quizCallbacks;
        qs._isHardcore     = isHardcore;
        qs._strokesDoneRef = () => strokesDone; // référence live

        strokeWriter.quiz(quizCallbacks);
    });
}

function updateSqScore() {
    if (!strokeQuizState) return;
    const qs = strokeQuizState;
    const done = qs.correct + qs.wrong;
    const scoreFloat = done > 0 ? (qs.correct / done * 10).toFixed(1) : '0.0';
    document.getElementById('sq-score-sub').textContent = `${scoreFloat} / 10.0`;
}

function closeStrokeQuiz() {
    if (sqTimerInterval) clearInterval(sqTimerInterval);
    strokeWriter = null;
    strokeQuizState = null;

    // Nettoyage du tracé kana (même overlay #stroke-quiz-view, état séparé)
    if (kanaTraceTimerInterval) clearInterval(kanaTraceTimerInterval);
    if (kanaTraceState && kanaTraceState._nextTimer) clearTimeout(kanaTraceState._nextTimer);
    if (kanaTraceWriter) { try { kanaTraceWriter.cancelQuiz(); } catch(_) {} }
    kanaTraceWriter = null;
    kanaTraceState  = null;

    document.getElementById('stroke-quiz-view').style.display = 'none';
}

/* ─────────────────────────────────────────────────
   Boutons auxiliaires
───────────────────────────────────────────────── */
function sqShowHint() {
    if (!strokeWriter || !strokeQuizState) return;
    const qs = strokeQuizState;
    const k  = kanjiDb[qs.indices[qs.idx]];
    if (!k || !qs._quizCallbacks) return;

    // Nombre de traits déjà validés
    const strokesDone = qs._strokesDoneRef ? qs._strokesDoneRef() : 0;
    if (strokesDone >= k.strokes) return;

    // Compter comme erreur
    qs.mistakesThisKanji++;
    const fb = document.getElementById('sq-feedback');
    if (fb) { fb.style.color = '#f5a623'; fb.textContent = `💡 Indice — trait ${strokesDone + 1}`; }

    // API HanziWriter réelle :
    // cancelQuiz() → animateStroke(N) → quiz({ quizStartStrokeNum: N+1, ...mêmes callbacks })
    try { strokeWriter.cancelQuiz(); } catch(_) {}

    strokeWriter.animateStroke(strokesDone, {
        onComplete: () => {
            if (!strokeQuizState || !strokeWriter) return;
            setTimeout(() => {
                if (!strokeQuizState || !strokeWriter) return;
                if (fb) fb.textContent = '';
                strokeWriter.quiz({
                    quizStartStrokeNum:  strokesDone + 1,
                    showHintAfterMisses: qs._isHardcore ? false : 1,
                    ...qs._quizCallbacks
                });
            }, 400);
        }
    });
}

function sqSkip() {
    if (!strokeQuizState) return;
    if (strokeQuizState._nextTimer) { clearTimeout(strokeQuizState._nextTimer); strokeQuizState._nextTimer = null; }
    if (strokeWriter) { try { strokeWriter.cancelQuiz(); } catch(_) {} strokeWriter = null; }
    const sqBody = document.getElementById('stroke-quiz-body');
    if (sqBody) sqBody.classList.remove('tracing');
    strokeQuizState.wrong++;
    strokeQuizState.idx++;
    document.getElementById('sq-wrong').textContent = strokeQuizState.wrong;
    updateSqScore();
    renderStrokeQuizQuestion();
}

/* ─────────────────────────────────────────────────
   Résultats stroke quiz
───────────────────────────────────────────────── */
function renderStrokeQuizResults() {
    if (sqTimerInterval) { clearInterval(sqTimerInterval); sqTimerInterval = null; }
    if (!strokeQuizState) return;
    document.getElementById('sq-prog-bar').style.width = '100%';

    const { correct, wrong, indices, sourceType, sourceId, elapsedSec } = strokeQuizState;
    const total   = indices.length;
    const pct     = Math.round(correct / total * 100);
    const emoji   = pct >= 80 ? '🎉' : pct >= 60 ? '👍' : pct >= 40 ? '💪' : '😅';
    const msg     = pct >= 80 ? 'Excellent !' : pct >= 60 ? 'Bien joué !' : pct >= 40 ? 'Continuez !' : 'À réviser…';
    const m = Math.floor(elapsedSec / 60), s = elapsedSec % 60;
    
    // Save trace scores to localStorage for each kanji
    indices.forEach(idx => {
        const kanji = kanjiDb[idx];
        if (kanji) {
            localStorage.setItem(`trace_${kanji.char}`, pct);
        }
    });
    
    // Si la session vient de la file de révision SRS, on nourrit aussi le planning générique
    if (sourceType === 'queue') {
        const quality = pct >= 80 ? 3 : pct >= 60 ? 2 : pct >= 40 ? 1 : 0;
        indices.forEach(idx => {
            const kanji = kanjiDb[idx];
            if (kanji) gradeReview(kanji.char, quality, { type: 'kanji', label: kanji.char });
        });
    }
    
    // Re-render dashboard if visible (for single kanji practice)
    if (sourceType === 'single') {
        renderDashboard();
    }

    document.getElementById('stroke-quiz-body').innerHTML = `
        <div class="quiz-results" style="padding-top:40px">
            <div class="quiz-results-emoji">${emoji}</div>
            <div class="quiz-score-big">${pct}%</div>
            <div class="quiz-score-label">${msg}</div>
            <div class="quiz-breakdown">
                <div class="quiz-breakdown-row"><span>✔ Sans erreur</span><strong style="color:var(--accent)">${correct}</strong></div>
                <div class="quiz-breakdown-row"><span>✘ Avec erreurs</span><strong style="color:#e55">${wrong}</strong></div>
                <div class="quiz-breakdown-row"><span>Total</span><strong>${total}</strong></div>
                <div class="quiz-breakdown-row"><span>Temps</span><strong>${m}:${String(s).padStart(2,'0')}</strong></div>
            </div>
            <div class="quiz-btn-row">
                <button class="quiz-action-btn secondary" onclick="closeStrokeQuiz()">Fermer</button>
                <button class="quiz-action-btn primary"
                    onclick="startStrokeQuiz({type:'${sourceType}',id:'${sourceId}'})">Rejouer ↺</button>
            </div>
        </div>`;
}

/* ══════════════════════════════════════════════════
   KANA DATA
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
const kanaGroups = {
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

let currentKanaTabType = 'hira'; // suivi de l'onglet actif, utile pour "Tout sélectionner" et le retour en mode normal

function loadKanas() {
    document.getElementById('page-title').innerText = 'Kana';
    renderKanaScreen('hira');
}

// Redessine l'écran complet (onglets + bouton Sélectionner + grille) — nécessaire pour que
// le bouton Sélectionner disparaisse/réapparaisse correctement selon bulkSelectMode.
function renderKanaScreen(type) {
    currentKanaTabType = type;
    document.getElementById('main-content').innerHTML = `
        <div class="kana-tabs">
            <div class="kana-tab ${type === 'hira' ? 'active' : ''}" id="tab-hira" onclick="switchKanaTab('hira')">Hiragana あ</div>
            <div class="kana-tab ${type === 'kata' ? 'active' : ''}" id="tab-kata" onclick="switchKanaTab('kata')">Katakana ア</div>
            ${!bulkSelectMode ? `<button class="bulk-select-toggle-btn" onclick="enterBulkSelectMode(() => renderKanaScreen(currentKanaTabType))">☑ Sélectionner</button>` : ''}
        </div>
        <div id="kana-grid-container" style="padding:12px"></div>`;
    renderKanaGrid(type);
}

function switchKanaTab(type) {
    renderKanaScreen(type);
}

function renderKanaGrid(type) {
    const container = document.getElementById('kana-grid-container');
    container.innerHTML = '';
    for (const group of kanaGroups[type]) {
        if (group.title) {
            const h = document.createElement('div');
            h.className = 'kana-section-title';
            if (bulkSelectMode) {
                const groupIds = [];
                group.rows.forEach(row => row.forEach(k => { if (k) groupIds.push('kana_' + k.c); }));
                const allMastered = groupIds.length > 0 && groupIds.every(id => getItemStatus(id) === 'mastered');
                h.style.display = 'flex';
                h.style.alignItems = 'center';
                h.style.gap = '8px';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'bulk-cat-checkbox';
                checkbox.checked = allMastered;
                checkbox.onclick = (e) => { e.stopPropagation(); toggleCategoryMasteryLive(checkbox, groupIds); };
                const span = document.createElement('span');
                span.textContent = group.title;
                h.appendChild(checkbox);
                h.appendChild(span);
            } else {
                h.textContent = group.title;
            }
            container.appendChild(h);
        }
        const grid = document.createElement('div');
        grid.className = 'kana-grid';
        for (const row of group.rows) {
            for (const kana of row) {
                const cell = document.createElement('div');
                if (!kana) {
                    cell.className = 'kana-cell empty';
                } else {
                    const isYoon = [...kana.c].length > 1;
                    const kanaId = 'kana_' + kana.c;
                    const isKanaMastered = getItemStatus(kanaId) === 'mastered';
                    cell.className = 'kana-cell';
                    cell.style.position = 'relative';
                    cell.innerHTML = `${isKanaMastered ? '<span class="mastered-check">✔</span>' : ''}<span class="kana-char${isYoon?' yoon':''}">${kana.c}</span><span class="kana-rom">${kana.r}</span>`;
                    cell.onclick = () => handleListItemClick(cell, kanaId, () => openKanaDetail(kana));
                }
                grid.appendChild(cell);
            }
        }
        container.appendChild(grid);
    }
}

/* ══════════════════════════════════════════════════
   TRACÉ KANA (normal + hardcore)
   ─────────────────────────────────────────────────
   Réutilise le même overlay #stroke-quiz-view / #stroke-quiz-body que le
   tracé kanji, avec un état dédié (kanaTraceState / kanaTraceWriter).
   Supporte : un kana seul (depuis la fiche détail) OU une file de kana
   dus en révision (comme kanjiDb en mode 'queue'), ET les combinaisons
   yōon (2 code points, ex. きゃ) tracées séquentiellement dans deux
   writers positionnés comme dans animateKanaChar (grand + petit coin).
   closeStrokeQuiz() nettoie systématiquement cet état (bouton retour).
══════════════════════════════════════════════════ */
let kanaTraceState         = null;
let kanaTraceWriter        = null; // writer du sous-caractère actif (1 seul à la fois, même en yōon)
let kanaTraceTimerInterval = null;
let kanaTracePaused        = false;
let _kanaTraceSource       = null; // { queue, sourceType } en attente de choix de mode (modal)

function showKanaTraceModal(kana) {
    _kanaTraceSource = { queue: [kana], sourceType: 'single' };
    const m = document.getElementById('kana-trace-modal');
    if (!m) return;
    m.classList.add('open');
    m.style.display = 'flex';
}

function closeKanaTraceModal() {
    const m = document.getElementById('kana-trace-modal');
    if (!m) return;
    m.classList.remove('open');
    m.style.display = 'none';
}

function launchKanaTraceMode(mode) {
    const source = _kanaTraceSource;
    closeKanaTraceModal();
    if (!source || !source.queue || !source.queue.length) return;
    startKanaTraceQuiz(source.queue, mode, source.sourceType);
}

// Entrée depuis l'onglet Révisions → Kana → mode "Tracé normal"/"Tracé difficile"
function startKanaTraceReview(script, mode) {
    const dueKana = getDueKanaChars(script);
    if (dueKana.length === 0) { alert('Rien à réviser pour le moment ! 🎉'); return; }
    pushModalState('kana-trace-review');
    const queue = dueKana.map(k => ({ c: k.char, r: k.romaji, id: k.id }));
    startKanaTraceQuiz(queue, mode, 'queue');
}

function startKanaTraceQuiz(kanaOrQueue, mode = 'trace-easy', sourceType = 'single') {
    const queue = Array.isArray(kanaOrQueue) ? kanaOrQueue : [kanaOrQueue];
    if (!queue.length) return;

    if (kanaTraceTimerInterval) clearInterval(kanaTraceTimerInterval);
    kanaTracePaused = false;

    kanaTraceState = {
        queue, idx: 0, mode, sourceType,
        correct: 0, wrong: 0,
        elapsedSec: 0
    };

    document.getElementById('sq-correct').textContent   = '0';
    document.getElementById('sq-wrong').textContent     = '0';
    document.getElementById('sq-timer').textContent     = '0:00';
    document.getElementById('sq-score-sub').textContent = '';
    document.getElementById('sq-prog-bar').style.width  = '0%';
    document.getElementById('stroke-quiz-view').style.display = 'flex';

    kanaTraceTimerInterval = setInterval(() => {
        if (!kanaTracePaused && kanaTraceState) {
            kanaTraceState.elapsedSec++;
            const m = Math.floor(kanaTraceState.elapsedSec / 60);
            const s = kanaTraceState.elapsedSec % 60;
            document.getElementById('sq-timer').textContent = `${m}:${String(s).padStart(2,'0')}`;
        }
    }, 1000);

    renderKanaTraceQuestion();
}

function renderKanaTraceQuestion() {
    if (!kanaTraceState) return;
    const qs = kanaTraceState;
    if (qs.idx >= qs.queue.length) { renderKanaTraceResults(); return; }

    if (qs._nextTimer) { clearTimeout(qs._nextTimer); qs._nextTimer = null; }
    if (kanaTraceWriter) { try { kanaTraceWriter.cancelQuiz(); } catch(_) {} kanaTraceWriter = null; }

    const kana       = qs.queue[qs.idx];
    const isHardcore = (qs.mode === 'trace-hard');
    const chars      = [...kana.c];
    const isMulti    = chars.length > 1; // yōon : 2 code points à tracer l'un après l'autre

    const scriptLabel = (kana.c.codePointAt(0) >= 0x30A0) ? 'Katakana' : 'Hiragana';

    document.getElementById('sq-prog-bar').style.width = (qs.idx / qs.queue.length * 100).toFixed(1) + '%';
    document.getElementById('sq-counter').textContent  = `${qs.idx + 1} / ${qs.queue.length}`;

    const canvasHtml = isMulti
        ? `<div class="sq-canvas-wrap multi" id="sq-canvas-wrap" style="touch-action:none;">
               <div class="sq-writer-target main pending"  id="sq-writer-target-0"></div>
               <div class="sq-writer-target small pending" id="sq-writer-target-1"></div>
           </div>`
        : `<div class="sq-canvas-wrap" id="sq-canvas-wrap" style="touch-action:none;">
               <div id="sq-writer-target"></div>
               <div class="sq-grid-overlay"></div>
           </div>`;

    document.getElementById('stroke-quiz-body').innerHTML = `
        <div class="sq-kanji-header">
            <div class="sq-meaning" style="font-size:1.375rem;font-weight:bold">${kana.r}</div>
            <div style="font-size:0.75rem;color:var(--gray);margin-top:4px">${scriptLabel}${isMulti ? ' · Yōon (2 traits séquentiels)' : ''}</div>
        </div>
        ${canvasHtml}
        <div id="sq-feedback" style="height:22px;margin-top:10px;font-weight:bold;text-align:center;font-size:0.8125rem;color:var(--gray)"></div>
        <div class="sq-actions">
            <button class="sq-btn hint" onclick="kanaTraceHint()">💡 Indice</button>
            <button class="sq-btn skip" onclick="kanaTraceSkip()">Passer →</button>
        </div>`;

    // Même délai d'une frame que pour le tracé kanji : laisser le DOM se stabiliser
    // avant d'initialiser HanziWriter (évite le bug "élément invisible")
    requestAnimationFrame(() => {
        if (!kanaTraceState || kanaTraceState.idx !== qs.idx) return;

        const sqBody = document.getElementById('stroke-quiz-body');
        if (sqBody) sqBody.classList.add('tracing');

        let subIdx        = 0;
        let itemMistakes  = 0;
        let subStrokesDone = 0;
        let lastStrokeTimer = null;
        let _subCompleted   = false;
        let _itemCompleted  = false;

        const lockScroll = (targetId) => {
            requestAnimationFrame(() => {
                const target = document.getElementById(targetId);
                if (!target) return;
                target.style.touchAction = 'none';
                target.querySelectorAll('*').forEach(el => { el.style.touchAction = 'none'; });
                target.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
            });
        };

        const finishItem = (totalMistakes) => {
            if (_itemCompleted) return;
            _itemCompleted = true;
            if (lastStrokeTimer) { clearTimeout(lastStrokeTimer); lastStrokeTimer = null; }
            if (!kanaTraceState) return;

            const sqBody2 = document.getElementById('stroke-quiz-body');
            if (sqBody2) sqBody2.classList.remove('tracing');

            const isClean = totalMistakes === 0;
            if (isClean) { qs.correct++; markMastered(kana.c); }
            else           qs.wrong++;
            document.getElementById('sq-correct').textContent = qs.correct;
            document.getElementById('sq-wrong').textContent   = qs.wrong;

            // File de révision : nourrit le planning SRS comme la flashcard kana
            if (kana.id) {
                const quality = totalMistakes === 0 ? 3 : totalMistakes <= 2 ? 2 : totalMistakes <= 4 ? 1 : 0;
                gradeReview(kana.id, quality, { type: 'kana', label: kana.c });
            }

            const fb = document.getElementById('sq-feedback');
            if (fb) {
                fb.style.color = isClean ? 'var(--accent)' : '#e55';
                fb.textContent = isClean ? '✔ Parfait !' : `Terminé — ${totalMistakes} erreur${totalMistakes > 1 ? 's' : ''}`;
            }

            qs._nextTimer = setTimeout(() => {
                qs._nextTimer = null;
                if (!kanaTraceState) return;
                kanaTraceState.idx++;
                renderKanaTraceQuestion();
            }, 1100);
        };

        const startSub = () => {
            if (subIdx >= chars.length) { finishItem(itemMistakes); return; }
            _subCompleted   = false;
            subStrokesDone  = 0;

            const targetId = isMulti ? `sq-writer-target-${subIdx}` : 'sq-writer-target';
            if (isMulti) {
                const prevTarget = subIdx > 0 ? document.getElementById(`sq-writer-target-${subIdx - 1}`) : null;
                if (prevTarget) { prevTarget.classList.remove('pending'); prevTarget.classList.add('sub-done'); }
                const curTarget = document.getElementById(targetId);
                if (curTarget) curTarget.classList.remove('pending');
            }

            // Le premier sous-caractère (ou l'unique, hors yōon) garde la taille pleine ;
            // le second (petit modificateur yōon) est rendu plus petit, comme dans animateKanaChar
            const dims = isMulti
                ? (subIdx === 0 ? { width: 190, height: 190, padding: 16 } : { width: 108, height: 108, padding: 8 })
                : {};

            kanaTraceWriter = createStrokeWriter(targetId, chars[subIdx], isHardcore, {
                dataLoader:  kanaDataLoader,
                onDataError: kanaTraceSkip,
                ...dims
            });
            if (!kanaTraceWriter) { kanaTraceSkip(); return; }
            lockScroll(targetId);

            const advanceSub = () => {
                if (_subCompleted) return;
                _subCompleted = true;
                if (lastStrokeTimer) { clearTimeout(lastStrokeTimer); lastStrokeTimer = null; }
                subIdx++;
                startSub();
            };

            const subCallbacks = {
                onMistake() {
                    itemMistakes++;
                    const wrap = document.getElementById('sq-canvas-wrap');
                    if (wrap) { wrap.classList.add('flash-err'); setTimeout(() => wrap.classList.remove('flash-err'), 350); }
                    const fb = document.getElementById('sq-feedback');
                    if (fb) { fb.style.color = '#e55'; fb.textContent = isHardcore ? 'Mauvais tracé !' : 'Mauvais tracé, regarde l\'aide…'; }
                },
                onCorrectStroke(strokeData) {
                    subStrokesDone++;
                    const wrap = document.getElementById('sq-canvas-wrap');
                    if (wrap) { wrap.classList.add('flash-ok'); setTimeout(() => wrap.classList.remove('flash-ok'), 350); }
                    const fb = document.getElementById('sq-feedback');
                    if (fb) { fb.style.color = 'var(--accent)'; fb.textContent = 'Bien !';
                        setTimeout(() => { if (fb && fb.textContent === 'Bien !') fb.textContent = ''; }, 800); }

                    // strokesRemaining fourni par HanziWriter : pas besoin de connaître le
                    // nombre total de traits à l'avance (contrairement au kanji qui le lit
                    // dans kanjiDb — les kana n'ont pas cette donnée statique).
                    if (strokeData && strokeData.strokesRemaining === 0) {
                        lastStrokeTimer = setTimeout(advanceSub, (isMulti && subIdx < chars.length - 1) ? 350 : 700);
                    }
                },
                onComplete() { advanceSub(); }
            };
            qs._quizCallbacks  = subCallbacks;
            qs._isHardcore     = isHardcore;
            qs._strokesDoneRef = () => subStrokesDone;

            kanaTraceWriter.quiz(subCallbacks);
        };

        startSub();
    });
}

function kanaTraceHint() {
    if (!kanaTraceWriter || !kanaTraceState || !kanaTraceState._quizCallbacks) return;
    const qs = kanaTraceState;
    const strokesDone = qs._strokesDoneRef ? qs._strokesDoneRef() : 0;

    const fb = document.getElementById('sq-feedback');
    if (fb) { fb.style.color = '#f5a623'; fb.textContent = `💡 Indice — trait ${strokesDone + 1}`; }

    try { kanaTraceWriter.cancelQuiz(); } catch(_) {}

    kanaTraceWriter.animateStroke(strokesDone, {
        onComplete: () => {
            if (!kanaTraceState || !kanaTraceWriter) return;
            setTimeout(() => {
                if (!kanaTraceState || !kanaTraceWriter) return;
                if (fb) fb.textContent = '';
                kanaTraceWriter.quiz({
                    quizStartStrokeNum:  strokesDone + 1,
                    showHintAfterMisses: qs._isHardcore ? false : 1,
                    ...qs._quizCallbacks
                });
            }, 400);
        }
    });
}

// Passe l'item courant (kana entier, y compris ses 2 traits en yōon) et avance dans la file
function kanaTraceSkip() {
    if (!kanaTraceState) return;
    const qs = kanaTraceState;
    if (qs._nextTimer) { clearTimeout(qs._nextTimer); qs._nextTimer = null; }
    if (kanaTraceWriter) { try { kanaTraceWriter.cancelQuiz(); } catch(_) {} kanaTraceWriter = null; }
    const sqBody = document.getElementById('stroke-quiz-body');
    if (sqBody) sqBody.classList.remove('tracing');

    qs.wrong++;
    document.getElementById('sq-wrong').textContent = qs.wrong;

    const kana = qs.queue[qs.idx];
    if (kana && kana.id) gradeReview(kana.id, 0, { type: 'kana', label: kana.c });

    qs.idx++;
    renderKanaTraceQuestion();
}

function renderKanaTraceResults() {
    if (kanaTraceTimerInterval) { clearInterval(kanaTraceTimerInterval); kanaTraceTimerInterval = null; }
    if (!kanaTraceState) return;
    document.getElementById('sq-prog-bar').style.width = '100%';

    const qs = kanaTraceState;
    const { correct, wrong, queue, sourceType, elapsedSec } = qs;
    const total = queue.length;
    const pct   = Math.round(correct / total * 100);
    const emoji = pct >= 80 ? '🎉' : pct >= 60 ? '👍' : pct >= 40 ? '💪' : '😅';
    const msg   = pct >= 80 ? 'Excellent !' : pct >= 60 ? 'Bien joué !' : pct >= 40 ? 'Continuez !' : 'À réviser…';
    const m = Math.floor(elapsedSec / 60), s = elapsedSec % 60;

    if (sourceType === 'queue') recordSessionCompleted();

    const singleRow = (total === 1)
        ? `<div class="quiz-breakdown-row"><span>Kana</span><strong>${queue[0].c} (${queue[0].r})</strong></div>`
        : '';

    document.getElementById('stroke-quiz-body').innerHTML = `
        <div class="quiz-results" style="padding-top:40px">
            <div class="quiz-results-emoji">${emoji}</div>
            <div class="quiz-score-big">${pct}%</div>
            <div class="quiz-score-label">${msg}</div>
            <div class="quiz-breakdown">
                ${singleRow}
                <div class="quiz-breakdown-row"><span>✔ Sans erreur</span><strong style="color:var(--accent)">${correct}</strong></div>
                <div class="quiz-breakdown-row"><span>✘ Avec erreurs</span><strong style="color:#e55">${wrong}</strong></div>
                <div class="quiz-breakdown-row"><span>Total</span><strong>${total}</strong></div>
                <div class="quiz-breakdown-row"><span>Temps</span><strong>${m}:${String(s).padStart(2,'0')}</strong></div>
            </div>
            <div class="quiz-btn-row">
                <button class="quiz-action-btn secondary" onclick="closeStrokeQuiz()">Fermer</button>
                <button class="quiz-action-btn primary" onclick="startKanaTraceQuiz(kanaTraceState.queue, kanaTraceState.mode, '${sourceType}')">Rejouer ↺</button>
            </div>
        </div>`;
}

/* ══════════════════════════════════════════════════
   KANJIVG ANIMATION (conservé intégralement)
══════════════════════════════════════════════════ */
async function fetchPaths(char, signal) {
    const cp  = char.codePointAt(0).toString(16).padStart(5,'0');
    const res = await fetch(`https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@master/kanji/${cp}.svg`, {signal});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const doc = new DOMParser().parseFromString(await res.text(), 'image/svg+xml');
    return [...doc.querySelectorAll('path')].map(p => p.getAttribute('d'));
}
function makeGroup(dList, transform, color) {
    const NS = 'http://www.w3.org/2000/svg';
    const g  = document.createElementNS(NS, 'g');
    if (transform) g.setAttribute('transform', transform);
    for (const d of dList) {
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', d); p.setAttribute('fill', 'none');
        p.setAttribute('stroke', color); p.setAttribute('stroke-width', '3');
        p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
        p.setAttribute('vector-effect', 'non-scaling-stroke');
        g.appendChild(p);
    }
    return g;
}
async function animateKanaChar(char) {
    const chars  = [...char], isYoon = chars.length > 1;
    const svgEl  = document.getElementById('kana-writer-svg');
    const spn    = document.getElementById('writer-spinner');
    const hanz   = document.getElementById('kanji-writer-target');
    if (fetchCtrl) fetchCtrl.abort();
    fetchCtrl = new AbortController();
    const { signal } = fetchCtrl;
    kanaAnimTimeouts.forEach(clearTimeout); kanaAnimTimeouts = [];
    hanz.style.display = 'none'; svgEl.style.display = 'none'; spn.style.display = 'block';
    try {
        const groups = await Promise.all(chars.map(c => fetchPaths(c, signal)));
        if (signal.aborted) return;
        svgEl.innerHTML = ''; svgEl.setAttribute('viewBox', '0 0 109 109');
        const tf = isYoon ? ['scale(0.62)', 'translate(65,65) scale(0.35)'] : [null];
        chars.forEach((_, i) => svgEl.appendChild(makeGroup(groups[i], tf[i], '#2a2a3a')));
        const animPaths = [];
        chars.forEach((_, i) => {
            const g = makeGroup(groups[i], tf[i], '#00c9a7');
            svgEl.appendChild(g); animPaths.push(...g.querySelectorAll('path'));
        });
        spn.style.display = 'none'; svgEl.style.display = 'block';
        animPaths.forEach(p => {
            const len = p.getTotalLength();
            p.style.strokeDasharray = len; p.style.strokeDashoffset = len; p.style.transition = 'none';
        });
        const DUR = 550, PAU = 150; let delay = 100;
        animPaths.forEach(p => {
            const t = setTimeout(() => { p.style.transition = `stroke-dashoffset ${DUR}ms ease`; p.style.strokeDashoffset = '0'; }, delay);
            delay += DUR + PAU; kanaAnimTimeouts.push(t);
        });
        document.getElementById('d-strokes').innerText = groups.reduce((s,g) => s + g.length, 0);
    } catch(err) {
        if (err.name === 'AbortError') return;
        spn.style.display = 'none';
        svgEl.innerHTML = `<text x="54" y="80" text-anchor="middle" fill="#dde0eb" font-size="60" font-family="serif">${char}</text>`;
        svgEl.style.display = 'block';
        document.getElementById('d-strokes').innerText = '?';
    }
}

/* ══════════════════════════════════════════════════
   FONCTIONS GLOBALES : EXEMPLES & AUDIO
══════════════════════════════════════════════════ */

// Mots de vocabulaire utilisant ce kanji (lien symétrique aux puces kanji cliquables déjà
// présentes sur la fiche vocab). Cherche d'abord dans le niveau du kanji lui-même (le plus
// pertinent), puis élargit aux autres niveaux si rien n'y est trouvé.
async function renderLinkedVocab(char) {
    const title = document.getElementById('linked-vocab-title');
    const container = document.getElementById('linked-vocab-container');
    if (!title || !container) return;

    const k = kanjiDb.find(x => x.char === char);
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

async function renderExemples(char) {
    const container = document.getElementById('exemples-container');
    if (!container) return;
    container.innerHTML = '';

    let liste = null;
    
    // 1. Essayer de charger depuis data/nX/exemples.json si on a un niveau JLPT actif
    if (currentJLPTLevel && exemplesByLevel[currentJLPTLevel]) {
        const levelExamples = exemplesByLevel[currentJLPTLevel];
        if (levelExamples.kanji && levelExamples.kanji[char]) {
            liste = levelExamples.kanji[char];
        }
    }
    
    // 2. Fallback : charger depuis exemplesDb (universel, charge en bg dans init)
    if (!liste && exemplesDb && exemplesDb[char]) {
        liste = exemplesDb[char];
    }
    
    // 3. Si rien n'a été trouvé et qu'on a un niveau JLPT, charger en async
    if (!liste && currentJLPTLevel) {
        try {
            if (!exemplesByLevel[currentJLPTLevel]) {
                const res = await fetch(`./data/${currentJLPTLevel}/exemples.json`, { cache: 'no-store' });
                if (res.ok) {
                    exemplesByLevel[currentJLPTLevel] = await res.json();
                    if (exemplesByLevel[currentJLPTLevel].kanji && exemplesByLevel[currentJLPTLevel].kanji[char]) {
                        liste = exemplesByLevel[currentJLPTLevel].kanji[char];
                    }
                }
            }
        } catch (e) {
            console.warn(`Impossible de charger exemples pour ${currentJLPTLevel}:`, e);
        }
    }
    
    // 4. Si toujours rien, afficher un message
    if (!liste || liste.length === 0) {
        container.innerHTML = `
            <div style="font-size:0.5625rem;color:var(--gray);text-transform:uppercase;letter-spacing:1.2px;font-weight:700;margin-bottom:12px">Exemples et Lectures</div>
            <div style="color:var(--gray);font-size:0.8125rem;text-align:center;padding:20px;border:1px dashed var(--border);border-radius:10px;">Aucun exemple disponible</div>`;
        return;
    }

    // Format : { jp, ka?, ro?, fr }
    // ka = lecture kana de la phrase (nouveau), ro = romaji (ancien ou nouveau)
    const items = liste.map(ex => {
        const safe = (ex.jp || char).replace(/'/g, "\\'");
        const kanaLine   = ex.ka
            ? `<div style="font-size:0.88rem;color:#9b8bff;margin-bottom:3px;line-height:1.5">${ex.ka}</div>`
            : '';
        const romajiLine = ex.ro
            ? `<div style="font-size:0.78rem;color:var(--accent);margin-bottom:4px;font-family:monospace;opacity:0.8">${ex.ro}</div>`
            : '';
        return `<div onclick="speakSentence('${safe}')"
            style="position:relative;background:rgba(255,255,255,0.03);padding:14px 40px 14px 14px;border-radius:10px;margin-bottom:10px;cursor:pointer;border-left:3px solid var(--accent);transition:background 0.15s"
            onmouseenter="this.style.background='rgba(255,255,255,0.06)'"
            onmouseleave="this.style.background='rgba(255,255,255,0.03)'">
            <span style="position:absolute;top:12px;right:12px;font-size:1rem;opacity:0.7">🔊</span>
            <div style="font-size:1.1rem;color:#fff;margin-bottom:5px;line-height:1.4">${ex.jp}</div>
            ${kanaLine}${romajiLine}
            <div style="font-size:0.88rem;color:#a0a0b0;line-height:1.4">${ex.fr}</div>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div style="font-size:0.5625rem;color:var(--gray);text-transform:uppercase;letter-spacing:1.2px;font-weight:700;margin-bottom:12px">Exemples et Lectures</div>
        ${items}`;
}

function speakSentence(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = 'ja-JP';
    msg.rate = 0.8;
    window.speechSynthesis.speak(msg);
}

/* ══════════════════════════════════════════════════
   GESTION DES DÉTAILS (KANJI)
══════════════════════════════════════════════════ */

function openDetail(kanji) {
    pushModalState('kanji-detail');
    
    currentType = 'kanji'; 
    currentChar = kanji.char;
    window.currentKanjiForStroke = kanji.char;
    
    // Si kanji n'a pas toutes ses propriétés, chercher dans kanjiDb
    if (!kanji.meanings) {
        const fullKanji = kanjiDb.find(k => k.char === kanji.char);
        if (fullKanji) {
            kanji = fullKanji;
        }
    }

    // Chercher la catégorie (ancienne navigation) — peut être undefined avec JLPT
    const cat = [...categories.values()].find(c => c.indices.includes(kanjiMap.get(kanji.char)));

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
    // Afficher le niveau JLPT si on vient de cette navigation, sinon afficher la catégorie ancienne
    let levelDisplay = '–';
    if (currentJLPTLevel && jlptMapping) {
        levelDisplay = jlptMapping.levels[currentJLPTLevel].label;
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
    
    writer = HanziWriter.create('kanji-writer-target', kanji.char, {
        width: 160, height: 160, padding: 14,
        strokeColor: '#00c9a7', 
        outlineColor: '#88899E',   // = --surface, fond exact du writer-main
        charColor:    '#88899E',   // traits non-animés invisibles sur fond
        drawingColor: '#00c9a7', 
        showOutline: true,
        // ...
        charDataLoader: kanjiDataLoader
    });
    writer.animateCharacter();

    // 7. Stroke guide (async) — les exemples s'affichent dans tous les cas,
    // même si le fetch KanjiVG échoue (catch sur le reject de la promesse)
    renderStrokeGuide(kanji.char)
        .then(() => renderExemples(kanji.char))
        .catch(() => renderExemples(kanji.char))
        .finally(() => renderLinkedVocab(kanji.char));
}

function openKanaDetail(kana) {
    currentType = 'kana'; currentChar = kana.c;
    // Le kana n'a pas de "mots qui l'utilisent" (contrairement au kanji) — on vide cette section
    // qui pourrait sinon garder le contenu résiduel d'un kanji visité juste avant (même overlay partagé).
    const linkedTitle = document.getElementById('linked-vocab-title');
    const linkedContainer = document.getElementById('linked-vocab-container');
    if (linkedTitle) linkedTitle.style.display = 'none';
    if (linkedContainer) linkedContainer.innerHTML = '';
    const code = kana.c.codePointAt(0);
    const label = (code >= 0x3040 && code <= 0x309F) ? 'Hiragana' : 'Katakana';
    const isYoon = [...kana.c].length > 1, isSokuon = kana.c === 'っ' || kana.c === 'ッ';
    
    document.getElementById('detail-view').style.display = 'flex';
    document.getElementById('detail-char-title').innerText = kana.c;
    document.getElementById('d-level').innerText  = label;
    const dLevelWord = document.getElementById('d-level-word');
    if (dLevelWord) dLevelWord.style.display = 'none';
    document.getElementById('d-romaji').innerText = kana.r;
    refreshMasteryUI();
    document.getElementById('section-on').style.display  = 'none';
    document.getElementById('section-kun').style.display = 'none';
    document.getElementById('voice-feedback').textContent = '';

    // Masquer les boutons réservés aux kanji (audio, sauvegarde) — le tracé reste possible
    document.getElementById('btn-oral-test').style.display = 'none';
    window.currentKanaForStroke = kana;
    const dqb = document.getElementById('detail-quiz-btn');
    if (dqb) {
        dqb.style.display = '';
        dqb.title = "S'entraîner au tracé guidé";
    }
    const bsk = document.getElementById('btn-save-kanji');
    if (bsk) bsk.style.display = 'none';

    // Masquer la grille stroke guide
    document.getElementById('stroke-guide-grid').innerHTML = '';
    document.getElementById('stroke-guide-title').style.display = 'none';
    
    let meaning = `Syllabe « ${kana.r} »`;
    if (isYoon)   meaning = `Yoon (拗音) — combiné « ${kana.r} »`;
    if (isSokuon) meaning = 'Sokuon (促音) — double la consonne suivante';
    
    document.getElementById('d-meaning').innerText = meaning;
    document.getElementById('d-strokes').innerText = '…';
    document.getElementById('kanji-writer-target').innerHTML = '';
    document.getElementById('kanji-writer-target').style.display = 'none';
    
    // Vider les exemples pour les kana
    const exContainer = document.getElementById('exemples-container');
    if (exContainer) exContainer.innerHTML = '';
    
    animateKanaChar(kana.c);
}

function closeDetail() {
    document.getElementById('detail-view').style.display = 'none';
    kanaAnimTimeouts.forEach(clearTimeout); 
    kanaAnimTimeouts = [];
    if (fetchCtrl) { fetchCtrl.abort(); fetchCtrl = null; }

    const exContainer = document.getElementById('exemples-container');
    if (exContainer) exContainer.innerHTML = '';
}

function launchDetailTrace() {
    if (currentType === 'kana') {
        const kana = window.currentKanaForStroke;
        if (!kana) return;
        closeDetail();
        showKanaTraceModal(kana);
        return;
    }
    const char = window.currentKanjiForStroke;
    if (!char) return;
    closeDetail();
    startStrokeQuiz({ type: 'single', id: char, mode: 'trace-easy' });
}

function replayAnimation() {
    if (currentType === 'kanji' && typeof writer !== 'undefined' && writer) {
        // On lance l'animation complète
        writer.animateCharacter({
            onComplete: function() {
                // Dès que l'animation est finie, on vérifie si un quiz était actif
                // et si oui, on relance le mode dessin !
                if (writer._quiz) {
                    writer.quiz(); 
                }
            }
        });
    } 
    else if (currentType === 'kana' && currentChar) {
        animateKanaChar(currentChar);
    }
}

/* ══════════════════════════════════════════════════
   STROKE ORDER GUIDE
   Grille de mini-SVGs : chaque cellule i affiche
   • traits 1..i-1 en gris (outline)
   • trait i en vert accent (mis en valeur)
   • numéro i en haut à droite
   Source : KanjiVG (même fetchPaths() que l'animation kana)
══════════════════════════════════════════════════ */
async function renderStrokeGuide(char) {
    const row   = document.getElementById('stroke-guide-grid');
    const title = document.getElementById('stroke-guide-title');
    if (!row) return;

    row.innerHTML = '';
    if (title) title.style.display = 'none';

    try {        const cp  = char.codePointAt(0).toString(16).padStart(5,'0');
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

            // Traits précédents en gris
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

            // Trait courant en vert
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
    INIT & DASHBOARD LOGIC
   ══════════════════════════════════════════════════ */

// Map grades to JLPT levels and calculate mastery
function getJLPTLevel(grade) {
    if (!grade) return null;
    const g = parseInt(grade);
    if (g >= 1 && g <= 2) return 5; // N5
    if (g === 3) return 4; // N4
    if (g === 4 || g === 5) return 3; // N3
    if (g === 6 || g === 8) return 2; // N2 (including college)
    return 1; // N1 (rare/advanced)
}

// Calculate mastery score based on quiz performance and writing practice
function getKanjiMastery(kanjiChar) {
    const quizScore = parseInt(localStorage.getItem(`quiz_${kanjiChar}`) || '0');
    const traceScore = parseInt(localStorage.getItem(`trace_${kanjiChar}`) || '0');
    // Average of both scores, or 0 if no practice
    if (quizScore === 0 && traceScore === 0) return 0;
    return Math.round((quizScore + traceScore) / 2);
}

// 1. La fonction de rendu du Dashboard (doit être définie AVANT init)
// Cache des stats vocab/grammaire par niveau, pour éviter de refetch à chaque ouverture du dashboard
const levelStatsCache = {};

// Cache partagé des données brutes vocab (réutilisé par le CTA de révision ET les stats du dashboard)
const vocabDataCache = {};

async function getLevelVocabData(levelId) {
    if (levelId in vocabDataCache) return vocabDataCache[levelId];
    
    try {
        const res = await fetch(`./data/${levelId}/vocab.json`, { cache: 'no-store' });
        if (!res.ok) { vocabDataCache[levelId] = null; return null; }
        const data = flattenIfNested(await res.json());
        
        let examples = null;
        try {
            const exRes = await fetch(`./data/${levelId}/exemples.json`, { cache: 'no-store' });
            if (exRes.ok) examples = await exRes.json();
        } catch (e) { /* pas d'exemples, tant pis */ }
        
        vocabDataCache[levelId] = { data, examples };
    } catch (e) {
        vocabDataCache[levelId] = null;
    }
    return vocabDataCache[levelId];
}

async function getLevelVocabGrammarStats(levelId) {
    if (levelStatsCache[levelId]) return levelStatsCache[levelId];
    
    const tracking = getTracking();
    const stats = { vocabTotal: 0, vocabMastered: 0, grammarTotal: 0, grammarMastered: 0 };
    
    const vd = await getLevelVocabData(levelId);
    if (vd && vd.data) {
        stats.vocabTotal = vd.data.length;
        stats.vocabMastered = vd.data.filter(w => tracking[w.id]?.status === 'mastered').length;
    }
    
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

// Cumule les cartes dues sur tous les niveaux ayant du vocabulaire déployé
// Quota global de 5 nouvelles cartes pour le bouton "Aujourd'hui" de l'accueil —
// volontairement plus bas que l'onglet "Apprendre" (10) : l'accueil est pensé comme
// un point d'entrée rapide/quotidien, "Apprendre" comme une session plus complète.
/* ══════════════════════════════════════════════════
   OBJECTIF DU JOUR — niveaux JLPT + scripts kana inclus dans "Aujourd'hui"
   ─────────────────────────────────────────────────
   Réglage persistant (localStorage), pas redemandé à chaque session.
   Par défaut (rien de sauvegardé) : tous les niveaux ET tout le kana,
   comme avant — personne n'est surpris par un changement de comportement
   silencieux. Contrairement aux niveaux JLPT (au moins un requis, sinon
   plus rien à réviser n'a de sens), le kana peut être désélectionné
   entièrement — légitime si l'utilisateur le considère acquis.
══════════════════════════════════════════════════ */
const DAILY_GOAL_KEY       = 'kanji_trad_daily_goal';
const DAILY_GOAL_KANA_KEY  = 'kanji_trad_daily_goal_kana';
const ALL_JLPT_LEVELS      = ['n5', 'n4', 'n3', 'n2', 'n1'];
const ALL_KANA_SCRIPTS     = ['hira', 'kata'];
const KANA_SCRIPT_LABELS   = { hira: 'Hiragana', kata: 'Katakana' };

function getDailyGoalLevels() {
    try {
        const stored = localStorage.getItem(DAILY_GOAL_KEY);
        if (!stored) return [...ALL_JLPT_LEVELS];
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [...ALL_JLPT_LEVELS];
    } catch (e) {
        return [...ALL_JLPT_LEVELS];
    }
}

function saveDailyGoalLevels(levels) {
    localStorage.setItem(DAILY_GOAL_KEY, JSON.stringify(levels));
}

// Contrairement aux niveaux JLPT, un tableau vide est une valeur légitime ici
// (l'utilisateur ne veut aucun kana dans "Aujourd'hui") — pas de fallback sur "tout"
// si une valeur a déjà été explicitement sauvegardée, même vide.
function getDailyGoalKanaScripts() {
    try {
        const stored = localStorage.getItem(DAILY_GOAL_KANA_KEY);
        if (stored === null) return [...ALL_KANA_SCRIPTS];
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [...ALL_KANA_SCRIPTS];
    } catch (e) {
        return [...ALL_KANA_SCRIPTS];
    }
}

function saveDailyGoalKanaScripts(scripts) {
    localStorage.setItem(DAILY_GOAL_KANA_KEY, JSON.stringify(scripts));
}

// Libellé court affiché sur la carte accueil, ex: "N5, N4 · Hiragana, Katakana"

function renderDailyGoalModalContent() {
    const levelsContainer = document.getElementById('daily-goal-levels-list');
    const kanaContainer = document.getElementById('daily-goal-kana-list');
    if (!levelsContainer) return;

    const currentLevels = getDailyGoalLevels();
    const levels = jlptMapping
        ? Object.entries(jlptMapping.levels).sort((a, b) => a[1].order - b[1].order)
        : ALL_JLPT_LEVELS.map(id => [id, { label: id.toUpperCase(), label_full: '', color: '#00E5FF' }]);

    levelsContainer.innerHTML = levels.map(([levelId, levelData]) => `
        <label class="daily-goal-row">
            <input type="checkbox" class="daily-goal-checkbox" value="${levelId}"
                ${currentLevels.includes(levelId) ? 'checked' : ''}
                style="accent-color:${levelData.color || 'var(--accent)'}">
            <span class="daily-goal-row-label" style="color:${levelData.color || 'var(--text)'}">${levelData.label || levelId.toUpperCase()}</span>
            <span class="daily-goal-row-sub">${levelData.label_full || ''}</span>
        </label>
    `).join('');

    if (kanaContainer) {
        const currentKana = getDailyGoalKanaScripts();
        kanaContainer.innerHTML = ALL_KANA_SCRIPTS.map(script => `
            <label class="daily-goal-row">
                <input type="checkbox" class="daily-goal-kana-checkbox" value="${script}"
                    ${currentKana.includes(script) ? 'checked' : ''}
                    style="accent-color:#9D6EFF">
                <span class="daily-goal-row-label" style="color:#9D6EFF">${KANA_SCRIPT_LABELS[script]}</span>
            </label>
        `).join('');
    }
}

function showDailyGoalModal() {
    renderDailyGoalModalContent();
    renderQuotaLevelOptions();
    const m = document.getElementById('daily-goal-modal');
    if (!m) return;
    m.classList.add('open');
    m.style.display = 'flex';
}

function closeDailyGoalModal() {
    const m = document.getElementById('daily-goal-modal');
    if (!m) return;
    m.classList.remove('open');
    m.style.display = 'none';
}

function saveDailyGoalFromModal() {
    const checkedLevels = [...document.querySelectorAll('.daily-goal-checkbox:checked')].map(el => el.value);
    const checkedKana = [...document.querySelectorAll('.daily-goal-kana-checkbox:checked')].map(el => el.value);
    if (checkedLevels.length === 0 && checkedKana.length === 0) {
        alert('Choisis au moins un niveau ou un script de kana.');
        return;
    }
    const quotaLevel = document.querySelector('input[name="quota-level"]:checked')?.value || 'normal';

    saveDailyGoalLevels(checkedLevels);
    saveDailyGoalKanaScripts(checkedKana);
    saveQuotaLevel(quotaLevel);
    closeDailyGoalModal();
    const goalSubEl = document.getElementById('dashboard-goal-sub');
    if (goalSubEl) goalSubEl.textContent = 'Règle ton niveau de carte';
    renderDashboardReviewCta(); // recalcule le compte de révisions du jour avec le nouvel objectif
}

/* ══════════════════════════════════════════════════
   QUOTA CONFIGURABLE + QUOTA JOURNALIER (point #4 V2)
   ─────────────────────────────────────────────────
   Deux mécanismes distincts qui se combinent uniquement sur l'accueil ("Aujourd'hui") :
   - Le NIVEAU choisi (Léger/Normal/Intense) fixe la base — pour Accueil ET Apprendre,
     en gardant l'écart volontaire entre les deux (Accueil reste toujours < Apprendre).
   - Le quota JOURNALIER ne s'applique qu'à l'Accueil : au-delà de la base choisie, plus
     aucune nouvelle carte n'est proposée par ce bouton avant le lendemain — peu importe
     combien de fois on relance une session "Aujourd'hui" dans la même journée. Les cartes
     DUES restent illimitées, comme partout ailleurs. L'onglet Apprendre n'a pas de plafond
     journalier (cohérent avec sa vocation "session plus complète", pas "check quotidien").
══════════════════════════════════════════════════ */
const QUOTA_LEVEL_KEY = 'kanji_trad_quota_level';
const QUOTA_LEVELS = {
    relax:   { accueil: 3,  apprendre: 6,  label: '🐢 Léger'   },
    normal:  { accueil: 20, apprendre: 10, label: '📘 Normal'  },
    intense: { accueil: 30, apprendre: 20, label: '🚀 Intense' }
};

function getQuotaLevel() {
    const stored = localStorage.getItem(QUOTA_LEVEL_KEY);
    return (stored && QUOTA_LEVELS[stored]) ? stored : 'normal';
}
function saveQuotaLevel(level) {
    if (QUOTA_LEVELS[level]) localStorage.setItem(QUOTA_LEVEL_KEY, level);
}

const DAILY_NEW_USAGE_KEY = 'kanji_trad_daily_new_usage';

// Nombre de nouvelles cartes déjà proposées AUJOURD'HUI via le bouton Accueil (remis à zéro
// silencieusement dès que la date change, pas besoin de job de nettoyage).
function getDailyNewCardsUsedToday() {
    const stored = localStorage.getItem(DAILY_NEW_USAGE_KEY);
    if (!stored) return 0;
    try {
        const parsed = JSON.parse(stored);
        return parsed.date === todayStr() ? (parsed.count || 0) : 0;
    } catch (e) {
        return 0;
    }
}
function addDailyNewCardsUsed(n) {
    if (n <= 0) return;
    const current = getDailyNewCardsUsedToday();
    localStorage.setItem(DAILY_NEW_USAGE_KEY, JSON.stringify({ date: todayStr(), count: current + n }));
}

// Quota effectif restant pour l'accueil aujourd'hui = base choisie moins ce qui a déjà été
// consommé depuis minuit, jamais négatif.
function getAccueilEffectiveNewLimit() {
    const base = QUOTA_LEVELS[getQuotaLevel()].accueil;
    const used = getDailyNewCardsUsedToday();
    return Math.max(0, base - used);
}

function renderQuotaLevelOptions() {
    const container = document.getElementById('quota-level-options');
    if (!container) return;
    const current = getQuotaLevel();
    container.innerHTML = Object.entries(QUOTA_LEVELS).map(([id, def]) => `
        <label class="ft-radio-pill">
            <input type="radio" name="quota-level" value="${id}" ${id === current ? 'checked' : ''}>
            <span>${def.label}</span>
        </label>
    `).join('');
}

async function getDashboardDueCount() {
    const queue = await buildReviewQueue({ types: ['vocab', 'grammar', 'kanji'], levels: getDailyGoalLevels(), newLimit: getAccueilEffectiveNewLimit(), excludeMastered: true, includeKana: true, kanaScripts: getDailyGoalKanaScripts() });
    const newTotal = queue.filter(e => e.isNew).length;
    const dueTotal = queue.length - newTotal;
    return { total: queue.length, dueTotal, newTotal };
}

// Construit les petits badges colorés (niveau JLPT + scripts kana) reflétant l'objectif
// actuellement choisi — remplace le simple chevron "→" pour donner un aperçu direct.
function buildGoalBadgesHtml() {
    const items = [];
    getDailyGoalLevels().forEach(l => {
        items.push({
            label: jlptMapping?.levels?.[l]?.label || l.toUpperCase(),
            color: jlptMapping?.levels?.[l]?.color || 'var(--accent)'
        });
    });
    getDailyGoalKanaScripts().forEach(k => {
        items.push({ label: KANA_SCRIPT_LABELS[k] || k, color: '#9D6EFF' });
    });
    if (items.length === 0) return `<span class="dash-goal-chevron">→</span>`;

    const shown = items.slice(0, 2);
    const overflow = items.length - shown.length;
    const badges = shown.map(it =>
        `<span class="dash-goal-badge" style="background:${it.color}22;color:${it.color};border:1px solid ${it.color}44">${it.label}</span>`
    ).join('');
    const overflowBadge = overflow > 0
        ? `<span class="dash-goal-badge" style="background:rgba(255,255,255,0.08);color:var(--gray)">+${overflow}</span>`
        : '';
    return badges + overflowBadge;
}

async function renderDashboardReviewCta() {
    const el = document.getElementById('dashboard-review-cta');
    if (!el) return;
    
    const { total, dueTotal, newTotal } = await getDashboardDueCount();
    const goalRow = `
        <div class="dash-goal-row" onclick="showDailyGoalModal()">
            <span class="dash-goal-icon">⚙</span>
            <span class="dash-goal-text" id="dashboard-goal-sub">Règle ton niveau de carte</span>
            <span class="dash-goal-badges" id="dashboard-goal-badges">${buildGoalBadgesHtml()}</span>
        </div>
    `;
    
    if (total === 0) {
        el.innerHTML = `${goalRow}<div class="review-cta-empty">🎉 Rien à réviser aujourd'hui !</div>`;
        return;
    }
    
    el.innerHTML = `
        ${goalRow}
        <div class="review-cta-label">CARTES DU JOUR À RÉVISER</div>
        <div class="review-cta-split">
            <div class="review-cta-split-box">
                <div class="review-cta-split-num">${newTotal}</div>
                <div class="review-cta-split-label">Nouvelles</div>
            </div>
            <div class="review-cta-split-box">
                <div class="review-cta-split-num">${dueTotal}</div>
                <div class="review-cta-split-label">À réviser</div>
            </div>
        </div>
        <button class="review-cta-btn" onclick="startDashboardReview()">Commencer · ${total} Cartes →</button>
    `;
}

// Lance directement depuis l'accueil la MÊME file que celle annoncée par le bouton
// (fini le décalage : avant, le chiffre comptait tous les niveaux mais la session
// ne lançait que le vocabulaire du premier niveau en retard). Réutilise le mécanisme
// de session mixte partagé avec l'onglet "Apprendre" (launchMixedReviewSession).
async function startDashboardReview() {
    const queue = await buildReviewQueue({ types: ['vocab', 'grammar', 'kanji'], levels: getDailyGoalLevels(), newLimit: getAccueilEffectiveNewLimit(), excludeMastered: true, includeKana: true, kanaScripts: getDailyGoalKanaScripts() });
    launchMixedReviewSession(queue, 'mixed-review-dashboard', true);
}

// Point d'entrée navigable pour l'Entraînement libre (point #8 de la roadmap).
// Stub pour l'instant : le corps sera remplacé par le vrai écran de configuration
// (type × niveau × nombre de questions) à l'étape suivante — la navigation/retour
// arrière fonctionne déjà correctement dès maintenant.
/* ══════════════════════════════════════════════════
   ENTRAÎNEMENT LIBRE (point #8) — V1
   ─────────────────────────────────────────────────
   Isolation stricte vis-à-vis du SRS : answerTrainingCard() n'appelle
   JAMAIS gradeReview(). Stats stockées à part (TRAINING_STATS_KEY).
   Pool tiré de TOUT le contenu de la sélection (pas seulement dû/nouveau,
   contrairement à buildReviewQueue) — c'est précisément le but : pouvoir
   re-feuilleter des cartes déjà maîtrisées sans toucher au planning.
══════════════════════════════════════════════════ */
const TRAINING_STATS_KEY = 'kanji_trad_training_stats';

function getTrainingStats() {
    const stored = localStorage.getItem(TRAINING_STATS_KEY);
    return stored ? JSON.parse(stored) : { totalSessions: 0, totalAnswered: 0, totalCorrect: 0 };
}
function saveTrainingStats(s) { localStorage.setItem(TRAINING_STATS_KEY, JSON.stringify(s)); }
function recordTrainingSession(correct, total) {
    const s = getTrainingStats();
    s.totalSessions++;
    s.totalAnswered += total;
    s.totalCorrect += correct;
    saveTrainingStats(s);
}

// Reconstruit une entrée { type, level, item } complète à partir d'un id + son enregistrement
// de faiblesse (qui ne connaît que le type, pas le niveau) — recherche parmi les niveaux/scripts
// disponibles. Coût raisonnable : appelé seulement au clic sur le widget, jamais en boucle de rendu.
async function resolveWeaknessEntry(itemId, rec) {
    const type = rec.type;
    if (type === 'kana') {
        for (const script of ALL_KANA_SCRIPTS) {
            const found = getKanaFlatList(script).find(it => it.id === itemId);
            if (found) return { type: 'kana', level: script, item: found };
        }
        return null;
    }
    if (type === 'kanji') {
        const kanjiData = kanjiDb.find(k => k.char === itemId);
        return kanjiData ? { type: 'kanji', level: null, item: { char: itemId } } : null;
    }
    for (const level of ALL_JLPT_LEVELS) {
        const items = await getRawItemsForTypeLevel(type, level);
        const found = items.find(it => it.id === itemId);
        if (found) return { type, level, item: found };
    }
    return null;
}

async function openWeaknessItem(itemId) {
    const rec = getWeaknessData()[itemId];
    if (!rec) return;
    const entry = await resolveWeaknessEntry(itemId, rec);
    if (!entry) { alert('Cette fiche est introuvable (contenu peut-être modifié depuis).'); return; }
    showFicheCorrectionModal(entry);
}

// Lance directement une session d'Entraînement libre (isolée du SRS) sur toutes les notions
// actuellement faibles — réutilise entièrement le moteur du point #8, aucune nouvelle mécanique.
async function trainWeaknessItems() {
    const data = getWeaknessData();
    // Mêmes 5 notions que celles affichées dans le widget, dans le même ordre de priorité —
    // sinon le bouton "S'entraîner sur ces X notions" ne correspondrait pas à ce qui est montré.
    const ids = Object.entries(data)
        .sort((a, b) => computeWeaknessPriority(b[1]) - computeWeaknessPriority(a[1]))
        .slice(0, 5)
        .map(([id]) => id);
    if (ids.length === 0) return;

    const pool = [];
    for (const id of ids) {
        const entry = await resolveWeaknessEntry(id, data[id]);
        if (entry) pool.push(entry);
    }
    if (pool.length === 0) { alert('Aucune fiche disponible pour ces notions.'); return; }
    launchFreeTraining(pool, pool.length, { type: 'weakness', scope: 'weakness', countRaw: String(pool.length) });
}

async function renderWeaknessWidget() {
    const el = document.getElementById('dashboard-weakness-widget');
    if (!el) return;

    const data = getWeaknessData();
    const entries = Object.entries(data)
        .sort((a, b) => computeWeaknessPriority(b[1]) - computeWeaknessPriority(a[1]))
        .slice(0, 5);

    if (entries.length === 0) {
        el.style.display = 'none'; // pas de carte vide qui ne sert à rien
        return;
    }
    el.style.display = '';

    const typeIcons = { vocab: '📚', grammar: '📝', kanji: '🔤', kana: 'あ' };

    el.innerHTML = `
        <div class="section-title" style="font-size:0.6875rem;color:var(--gray);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">🧠 À renforcer</div>
        <div class="weakness-list">
            ${entries.map(([id, rec]) => `
                <div class="weakness-row" onclick="openWeaknessItem('${id.replace(/'/g, "\\'")}')">
                    <span class="weakness-icon">${typeIcons[rec.type] || '❓'}</span>
                    <span class="weakness-label">${rec.label}</span>
                    <span class="weakness-count">${rec.consecutiveFails}×</span>
                </div>
            `).join('')}
        </div>
        <button class="weakness-train-btn" onclick="trainWeaknessItems()">🎯 S'entraîner sur ${entries.length > 1 ? `ces ${entries.length} notions` : 'cette notion'}</button>
    `;
}

function showFreeTrainingConfig(isBack = false, preset = null) {
    if (!isBack) history.pushState({ view: 'free-training-config' }, '');
    document.getElementById('page-title').innerText = 'Entraînement libre';
    const presetType = preset?.type || 'all';

    const typeOptions = [
        { id: 'all',     label: 'Tout',         sub: 'Vocabulaire + Grammaire + Kanji + Kana' },
        { id: 'vocab',   label: 'Vocabulaire',  sub: '' },
        { id: 'grammar', label: 'Grammaire',    sub: '' },
        { id: 'kanji',   label: 'Kanji',        sub: '' },
        { id: 'kana',    label: 'Kana',         sub: 'Hiragana / Katakana' }
    ];

    document.getElementById('main-content').innerHTML = `
        <div style="padding:16px 16px 24px">
            <div class="free-training-banner">🏋️ Entraînement libre — sans impact sur tes révisions</div>

            ${presetType === 'all' ? `
            <div class="mode-section-label" style="margin-top:14px">— Contenu</div>
            <div class="ft-radio-group">
                ${typeOptions.map((o) => `
                    <label class="ft-radio-row">
                        <input type="radio" name="ft-type" value="${o.id}" ${o.id === presetType ? 'checked' : ''} onchange="onFreeTrainingTypeChange()">
                        <span class="ft-radio-label">${o.label}</span>
                        ${o.sub ? `<span class="ft-radio-sub">${o.sub}</span>` : ''}
                    </label>
                `).join('')}
            </div>
            ` : `<input type="radio" name="ft-type" value="${presetType}" checked style="display:none">`}

            <div class="mode-section-label" style="margin-top:14px" id="ft-scope-label">— Niveau</div>
            <div id="ft-scope-options" class="ft-radio-group"></div>

            <div class="mode-section-label" style="margin-top:14px">— Nombre de questions</div>
            <div class="ft-radio-group ft-radio-pills">
                ${[10, 20, 50, 0].map(n => `
                    <label class="ft-radio-pill">
                        <input type="radio" name="ft-count" value="${n}" ${n === 10 ? 'checked' : ''}>
                        <span>${n === 0 ? '∞' : n}</span>
                    </label>
                `).join('')}
            </div>

            <div class="mode-section-label" style="margin-top:14px">— Mode</div>
            <div class="ft-radio-group">
                <label class="ft-radio-row">
                    <input type="radio" name="ft-mode" value="normal" checked onchange="onFreeTrainingModeChange()">
                    <span class="ft-radio-label">Entraînement</span>
                    <span class="ft-radio-sub">Corrige à chaque carte</span>
                </label>
                <label class="ft-radio-row">
                    <input type="radio" name="ft-mode" value="blank" onchange="onFreeTrainingModeChange()">
                    <span class="ft-radio-label">Test blanc</span>
                    <span class="ft-radio-sub">Pas de fiche, résultats détaillés à la fin</span>
                </label>
                <label class="ft-radio-row">
                    <input type="radio" name="ft-mode" value="chrono" onchange="onFreeTrainingModeChange()">
                    <span class="ft-radio-label">Chrono</span>
                    <span class="ft-radio-sub">Le plus de cartes possible dans le temps imparti</span>
                </label>
                <label class="ft-radio-row">
                    <input type="radio" name="ft-mode" value="loop" onchange="onFreeTrainingModeChange()">
                    <span class="ft-radio-label">Boucle</span>
                    <span class="ft-radio-sub">Les cartes ratées reviennent dans la session</span>
                </label>
            </div>

            <div id="ft-chrono-duration-wrap" style="display:none">
                <div class="mode-section-label" style="margin-top:14px">— Durée</div>
                <div class="ft-radio-group ft-radio-pills">
                    <label class="ft-radio-pill"><input type="radio" name="ft-chrono-duration" value="60" checked><span>1 min</span></label>
                    <label class="ft-radio-pill"><input type="radio" name="ft-chrono-duration" value="180"><span>3 min</span></label>
                    <label class="ft-radio-pill"><input type="radio" name="ft-chrono-duration" value="300"><span>5 min</span></label>
                </div>
            </div>

            <div class="mode-section-label" style="margin-top:14px">— Filtres</div>
            <div class="ft-radio-group">
                <label class="ft-radio-row"><input type="checkbox" id="ft-filter-never-seen"><span class="ft-radio-label">Uniquement les cartes jamais vues</span></label>
            </div>

            <div class="mode-section-label" style="margin-top:14px">— Ordre</div>
            <div class="ft-radio-group ft-radio-pills">
                <label class="ft-radio-pill"><input type="radio" name="ft-order" value="random" checked><span>Aléatoire</span></label>
                <label class="ft-radio-pill"><input type="radio" name="ft-order" value="sequential"><span>Séquentiel</span></label>
            </div>

            <button class="review-cta-btn" style="width:100%;margin-top:22px" onclick="startFreeTraining()">Commencer →</button>
        </div>`;

    renderFreeTrainingScopeOptions(presetType, preset?.level);
}

function onFreeTrainingModeChange() {
    const mode = document.querySelector('input[name="ft-mode"]:checked')?.value || 'normal';
    const wrap = document.getElementById('ft-chrono-duration-wrap');
    if (wrap) wrap.style.display = (mode === 'chrono') ? '' : 'none';
}

function renderFreeTrainingScopeOptions(type, presetLevel = null) {
    const label = document.getElementById('ft-scope-label');
    const container = document.getElementById('ft-scope-options');
    if (!container || !label) return;

    if (type === 'kana') {
        label.textContent = '— Script';
        container.innerHTML = `
            <label class="ft-radio-row"><input type="radio" name="ft-scope" value="both" checked><span class="ft-radio-label">Les deux</span></label>
            <label class="ft-radio-row"><input type="radio" name="ft-scope" value="hira"><span class="ft-radio-label">Hiragana</span></label>
            <label class="ft-radio-row"><input type="radio" name="ft-scope" value="kata"><span class="ft-radio-label">Katakana</span></label>
        `;
    } else {
        label.textContent = '— Niveau';
        const levels = jlptMapping
            ? Object.entries(jlptMapping.levels).sort((a, b) => a[1].order - b[1].order)
            : ALL_JLPT_LEVELS.map(id => [id, { label: id.toUpperCase(), color: '#00E5FF' }]);
        const preset = presetLevel && levels.some(([id]) => id === presetLevel) ? presetLevel : 'all';
        container.innerHTML = `
            <label class="ft-radio-row"><input type="radio" name="ft-scope" value="all" ${preset === 'all' ? 'checked' : ''}><span class="ft-radio-label">Tous les niveaux</span></label>
            ${levels.map(([id, d]) => `<label class="ft-radio-row"><input type="radio" name="ft-scope" value="${id}" ${preset === id ? 'checked' : ''}><span class="ft-radio-label" style="color:${d.color || 'var(--text)'}">${d.label}</span></label>`).join('')}
        `;
    }
}

function onFreeTrainingTypeChange() {
    const type = document.querySelector('input[name="ft-type"]:checked')?.value || 'all';
    renderFreeTrainingScopeOptions(type);
}

// Pool complet (pas de filtre due/fresh, contrairement à buildReviewQueue) pour un
// ensemble de types/niveaux/scripts donné. Réutilise les mêmes fonctions de lecture
// de données que buildReviewQueue pour rester cohérent avec le reste de l'app.
async function buildTrainingPool({ types, levels, kanaScripts }) {
    const pool = [];
    for (const type of types.filter(t => t !== 'kana')) {
        for (const level of levels) {
            const items = await getRawItemsForTypeLevel(type, level);
            items.forEach(it => {
                const entry = makeQueueEntry(type, level, it, false);
                // Variété d'exercices (cloze/QCM/flashcard), comme en révision normale — sans ça
                // l'entraînement libre ne montrait jamais que des flashcards classiques.
                if (type === 'vocab') {
                    const prepared = prepareSessionItem(it, items);
                    entry.exercise = { type: prepared.type, clozeInfo: prepared.clozeInfo, qcmInfo: prepared.qcmInfo };
                } else if (type === 'grammar') {
                    const prepared = prepareGrammarSessionItem(it, items);
                    entry.exercise = { type: prepared.type, clozeInfo: prepared.clozeInfo };
                }
                pool.push(entry);
            });
        }
    }
    if (types.includes('kana')) {
        for (const script of kanaScripts) {
            const items = getKanaFlatList(script);
            items.forEach(it => pool.push(makeQueueEntry('kana', script, it, false)));
        }
    }
    return pool;
}

async function startFreeTraining() {
    const type = document.querySelector('input[name="ft-type"]:checked')?.value || 'all';
    const scope = document.querySelector('input[name="ft-scope"]:checked')?.value || 'all';
    const countRaw = document.querySelector('input[name="ft-count"]:checked')?.value ?? '10';
    const mode = document.querySelector('input[name="ft-mode"]:checked')?.value || 'normal';
    const chronoDuration = parseInt(document.querySelector('input[name="ft-chrono-duration"]:checked')?.value || '60', 10);
    const order = document.querySelector('input[name="ft-order"]:checked')?.value || 'random';
    const neverSeenOnly = document.getElementById('ft-filter-never-seen')?.checked || false;

    let targetCount = countRaw === '0' ? null : parseInt(countRaw, 10);
    // Chrono s'arrête sur le temps écoulé, pas sur un compte de cartes -> toujours en file "infinie"
    if (mode === 'chrono') targetCount = null;

    let types, levels, kanaScripts;
    if (type === 'kana') {
        types = ['kana']; levels = [];
        kanaScripts = scope === 'both' ? ['hira', 'kata'] : [scope];
    } else if (type === 'all') {
        types = ['vocab', 'grammar', 'kanji', 'kana'];
        levels = scope === 'all' ? ALL_JLPT_LEVELS : [scope];
        kanaScripts = ['hira', 'kata'];
    } else {
        types = [type];
        levels = scope === 'all' ? ALL_JLPT_LEVELS : [scope];
        kanaScripts = [];
    }

    let pool = await buildTrainingPool({ types, levels, kanaScripts });
    if (neverSeenOnly) {
        pool = pool.filter(entry => !getSrsInfo(getEntryTrackingId(entry)));
    }
    if (pool.length === 0) {
        alert('Aucun contenu disponible pour cette sélection.');
        return;
    }

    launchFreeTraining(pool, targetCount, {
        type, scope, countRaw, mode, order, neverSeenOnly,
        chronoDuration: mode === 'chrono' ? chronoDuration : null
    });
}

let trainingSession = null;
let trainingChronoInterval = null;

function launchFreeTraining(pool, targetCount, config) {
    pushModalState('free-training-session');
    if (trainingChronoInterval) { clearInterval(trainingChronoInterval); trainingChronoInterval = null; }

    const mode = (config && config.mode) || 'normal';
    const order = (config && config.order) || 'random';

    trainingSession = {
        pool, config, targetCount, mode, order,
        queue: [],
        index: 0,
        seqCursor: 0,
        correct: 0,
        wrong: 0,
        mistakes: [],
        flipped: false,
        quizAnswered: false,
        quizSelected: null,
        chronoRemaining: (config && config.chronoDuration) || null
    };
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;

    if (mode === 'chrono' && trainingSession.chronoRemaining) {
        trainingChronoInterval = setInterval(() => {
            if (!trainingSession) { clearInterval(trainingChronoInterval); trainingChronoInterval = null; return; }
            trainingSession.chronoRemaining--;
            if (trainingSession.chronoRemaining <= 0) {
                clearInterval(trainingChronoInterval);
                trainingChronoInterval = null;
                endTrainingSession();
            } else {
                renderTrainingScreen();
            }
        }, 1000);
    }

    renderTrainingScreen();
}

// Tire (ou retrouve) la carte courante. En mode fini, s'arrête à targetCount ; en mode
// infini (targetCount=null), tire indéfiniment jusqu'à ce que l'utilisateur ferme la session
// (ou que le chrono expire). Ordre "aléatoire" : anti-répétition simple (jamais 2x la même
// carte d'affilée). Ordre "séquentiel" : parcourt le pool dans son ordre naturel, en boucle.
function trainingEnsureNextItem() {
    const s = trainingSession;
    if (!s) return null;
    if (s.index < s.queue.length) return s.queue[s.index];
    if (s.targetCount && s.queue.length >= s.targetCount) return null;
    if (!s.pool.length) return null;

    let candidate;
    if (s.order === 'sequential') {
        candidate = s.pool[s.seqCursor % s.pool.length];
        s.seqCursor++;
    } else {
        let attempts = 0;
        do {
            candidate = s.pool[Math.floor(Math.random() * s.pool.length)];
            attempts++;
        } while (s.pool.length > 1 && s.queue.length > 0 &&
                 getEntryTrackingId(candidate) === getEntryTrackingId(s.queue[s.queue.length - 1]) &&
                 attempts < 10);
    }

    s.queue.push(candidate);
    return candidate;
}

function renderTrainingScreen() {
    const container = document.getElementById('category-content');
    const s = trainingSession;
    if (!s) return;
    if (!container) {
        // L'utilisateur a quitté via la bottom-nav (toujours cliquable, pas de cleanup automatique) :
        // le conteneur de session n'existe plus, on arrête le minuteur au lieu de planter dessus.
        if (trainingChronoInterval) { clearInterval(trainingChronoInterval); trainingChronoInterval = null; }
        trainingSession = null;
        return;
    }

    const entry = trainingEnsureNextItem();
    if (!entry) { renderTrainingResults(); return; }

    const { front, back, typeLabel, frontSize } = buildCardDisplay(entry);

    let progressText, progressFill;
    if (s.mode === 'chrono') {
        const total = (s.config && s.config.chronoDuration) || 60;
        const elapsed = total - s.chronoRemaining;
        const m = Math.floor(s.chronoRemaining / 60), sec = s.chronoRemaining % 60;
        progressText = `⏱ ${m}:${String(sec).padStart(2, '0')}`;
        progressFill = `<div class="review-progress-fill" style="width:${(elapsed / total) * 100}%"></div>`;
    } else {
        progressText = s.targetCount ? `${s.index + 1} / ${s.targetCount}` : `${s.index + 1}`;
        progressFill = s.targetCount ? `<div class="review-progress-fill" style="width:${(s.index / s.targetCount) * 100}%"></div>` : '';
    }

    const modeBanner = {
        normal: '🏋️ Sans impact sur tes révisions',
        blank:  '📝 Mode Test — résultats détaillés à la fin',
        chrono: '⏱ Mode Chrono — sans impact sur tes révisions',
        loop:   '🔁 Mode Boucle — les cartes ratées reviennent'
    }[s.mode] || '🏋️ Sans impact sur tes révisions';

    // En Test blanc, pas de fiche accessible pendant la question : on garde les conditions d'examen
    const ficheBtn = (s.mode !== 'blank')
        ? `<button class="fiche-correction-btn" onclick="showFicheCorrectionModal(trainingSession.queue[trainingSession.index])">📖 Voir la fiche</button>`
        : '';

    const headerHtml = `
        <div class="review-header">
            <button class="back-btn" onclick="endTrainingSession()">✕</button>
            <div class="review-progress-bar">${progressFill}</div>
            <div class="review-progress-text">${progressText}</div>
        </div>
        <div class="free-training-banner small">${modeBanner}</div>`;

    // Variété d'exercices (point corrigé : vocab/grammaire ne montraient jamais que des
    // flashcards en entraînement libre) — cloze/QCM utilisent leur propre écran interactif,
    // le reste (kanji, kana, flashcard) garde le flip-card classique ci-dessous.
    const exercise = entry.exercise;
    if (exercise && (exercise.type === 'cloze' || exercise.type === 'qcm')) {
        renderTrainingQuizExercise(container, headerHtml, entry, exercise);
        return;
    }

    container.innerHTML = `<div class="review-page">
        ${headerHtml}
        <div class="review-type-tag">${typeLabel}</div>
        <div class="review-card ${s.flipped ? 'flipped' : ''}" onclick="${s.flipped ? '' : 'flipTrainingCard()'}">
            <div class="review-card-front">
                <div class="review-word" style="font-size:${frontSize}px;">${front}</div>
            </div>
            ${s.flipped ? `<div class="review-card-back">${back}${ficheBtn}</div>` : `<div class="review-tap-hint">Touche la carte pour révéler</div>`}
        </div>
        ${s.flipped ? `
            <div class="review-grade-buttons ft-grade-buttons">
                <button class="grade-btn grade-again" onclick="answerTrainingCard(false)">✘ Incorrect</button>
                <button class="grade-btn grade-easy" onclick="answerTrainingCard(true)">✔ Correct</button>
            </div>
        ` : ''}
    </div>`;
}

// Rendu de l'exercice cloze (particule à trous, vocab/grammaire) ou QCM (sens du mot, vocab) en
// entraînement libre — auto-noté au clic, comme en révision normale, contrairement au flip-card
// qui demande une auto-évaluation manuelle.
function renderTrainingQuizExercise(container, headerHtml, entry, exercise) {
    const s = trainingSession;
    const answered = s.quizAnswered;
    const selected = s.quizSelected;
    let bodyHtml = '';

    if (exercise.type === 'cloze') {
        const word = entry.item;
        const clozeInfo = exercise.clozeInfo;
        const sentenceHtml = clozeInfo.tokens.map((tok, i) => {
            if (i !== clozeInfo.blankIndex) return `<span>${tok}</span>`;
            if (!answered) return `<span class="cloze-blank">＿＿</span>`;
            const cls = selected === clozeInfo.correct ? 'cloze-blank-filled correct' : 'cloze-blank-filled incorrect';
            return `<span class="${cls}">${selected}</span>`;
        }).join(' ');
        bodyHtml = `
            <div class="review-card review-cloze-card">
                <div class="review-quiz-instruction">Complète la phrase avec la bonne particule</div>
                <div class="cloze-sentence">${sentenceHtml}</div>
                <div class="review-romaji">${word.romaji || ''}</div>
                <div class="review-example-fr-only">${mdBold((word.example && word.example.french) || '')}</div>
            </div>
            <div class="review-options review-options-particles">
                ${clozeInfo.options.map(opt => {
                    let cls = 'review-option-btn';
                    if (answered) { if (opt === clozeInfo.correct) cls += ' correct'; else if (opt === selected) cls += ' incorrect'; }
                    return `<button class="${cls}" ${answered ? 'disabled' : ''} onclick="submitTrainingQuizAnswer('${opt}')">${opt}</button>`;
                }).join('')}
            </div>
            ${(answered && selected !== clozeInfo.correct && word.nuance) ? `<div class="vocab-nuance-box" style="margin-top:14px;text-align:left">💡 ${mdBold(word.nuance)}</div>` : ''}
        `;
    } else { // qcm (vocab uniquement)
        const word = entry.item;
        const qcmInfo = exercise.qcmInfo;
        bodyHtml = `
            <div class="review-card review-qcm-card">
                <div class="review-word">${word.word || ''}</div>
                <div class="review-reading">${word.reading || ''}</div>
                <div class="review-quiz-instruction">Quel est le sens de ce mot ?</div>
            </div>
            <div class="review-options">
                ${qcmInfo.options.map(opt => {
                    let cls = 'review-option-btn';
                    if (answered) { if (opt === qcmInfo.correct) cls += ' correct'; else if (opt === selected) cls += ' incorrect'; }
                    return `<button class="${cls}" ${answered ? 'disabled' : ''} onclick="submitTrainingQuizAnswer('${opt.replace(/'/g, "\\'")}')">${mdBold(opt)}</button>`;
                }).join('')}
            </div>
        `;
    }

    container.innerHTML = `<div class="review-page">
        ${headerHtml}
        ${bodyHtml}
        ${answered ? `<button class="review-continue-btn" onclick="advanceTrainingQuiz()">Continuer →</button>` : ''}
    </div>`;
}

function submitTrainingQuizAnswer(selected) {
    const s = trainingSession;
    if (!s || s.quizAnswered) return;
    const entry = s.queue[s.index];
    const exercise = entry.exercise;
    if (!exercise) return;
    const correct = exercise.type === 'cloze' ? exercise.clozeInfo.correct : exercise.qcmInfo.correct;
    const isCorrect = selected === correct;

    s.quizAnswered = true;
    s.quizSelected = selected;

    if (isCorrect) {
        s.correct++;
    } else {
        s.wrong++;
        s.mistakes.push(entry);
        if (s.mode === 'loop') s.pool.push(entry);
    }
    if (s.config && s.config.type === 'weakness') {
        updateWeaknessTracking(getEntryTrackingId(entry), isCorrect ? 2 : 0, { type: entry.type, label: getEntryLabel(entry) });
    }
    renderTrainingScreen();
}

function advanceTrainingQuiz() {
    const s = trainingSession;
    if (!s) return;
    s.index++;
    s.quizAnswered = false;
    s.quizSelected = null;
    renderTrainingScreen();
}

function flipTrainingCard() {
    if (!trainingSession) return;
    trainingSession.flipped = true;
    renderTrainingScreen();
}

// answerTrainingCard() n'appelle JAMAIS gradeReview() — c'est tout le principe de l'isolation.
// Mode Boucle : une carte ratée est remise dans le pool, donc repiochable plus tard dans la
// MÊME session (l'anti-répétition immédiate de trainingEnsureNextItem empêche qu'elle revienne
// littéralement à la question suivante).
// answerTrainingCard() n'appelle JAMAIS gradeReview() — c'est tout le principe de l'isolation.
// Exception ciblée : si la session vient du widget "À renforcer" (config.type === 'weakness'),
// la réponse met à jour le tracker de faiblesse — sinon s'entraîner dessus ne ferait jamais
// disparaître un item du widget, même à 100% de réussite, ce qui viderait le bouton "S'entraîner"
// de son utilité. Le SRS, lui, reste toujours intact : seul updateWeaknessTracking est appelé,
// jamais gradeReview.
function answerTrainingCard(isCorrect) {
    const s = trainingSession;
    if (!s) return;
    const entry = s.queue[s.index];
    if (isCorrect) {
        s.correct++;
    } else {
        s.wrong++;
        s.mistakes.push(entry);
        if (s.mode === 'loop') s.pool.push(entry);
    }
    if (s.config && s.config.type === 'weakness') {
        updateWeaknessTracking(getEntryTrackingId(entry), isCorrect ? 2 : 0, { type: entry.type, label: getEntryLabel(entry) });
    }
    s.index++;
    s.flipped = false;
    s.quizAnswered = false;
    s.quizSelected = null;
    renderTrainingScreen();
}

// Fermer manuellement (utile surtout en mode infini/chrono, où il n'y a pas de fin naturelle par
// compte de cartes) — affiche les résultats avec ce qui a été répondu jusqu'ici.
function endTrainingSession() {
    if (!trainingSession) return;
    renderTrainingResults();
}

function renderTrainingResults() {
    const s = trainingSession;
    if (!s) return;
    if (trainingChronoInterval) { clearInterval(trainingChronoInterval); trainingChronoInterval = null; }

    const container = document.getElementById('category-content');
    if (!container) { trainingSession = null; return; }
    const total = s.correct + s.wrong;
    const pct = total > 0 ? Math.round((s.correct / total) * 100) : 0;

    recordTrainingSession(s.correct, total);

    // Test blanc : détail carte par carte, seulement révélé maintenant (c'est tout le principe du mode)
    const detailHtml = (s.mode === 'blank' && s.queue.length > 0) ? `
        <div class="ft-results-detail">
            ${s.queue.slice(0, s.index).map(entry => {
                const isWrong = s.mistakes.includes(entry);
                return `<div class="ft-result-row ${isWrong ? 'wrong' : 'ok'}">
                    <span>${isWrong ? '✘' : '✔'}</span>
                    <span>${getEntryLabel(entry)}</span>
                </div>`;
            }).join('')}
        </div>
    ` : '';

    container.innerHTML = `<div class="review-summary">
        <div class="review-summary-title">Entraînement terminé ! 🏋️</div>
        <div class="review-summary-count">${total} carte${total > 1 ? 's' : ''} pratiquée${total > 1 ? 's' : ''}</div>
        <div class="review-summary-stats">
            <div class="review-stat"><span class="review-stat-dot easy"></span>Correct : ${s.correct}</div>
            <div class="review-stat"><span class="review-stat-dot again"></span>Incorrect : ${s.wrong}</div>
            <div class="review-stat">${pct}% de réussite</div>
        </div>
        ${detailHtml}
        <div class="quiz-btn-row" style="margin-top:20px">
            <button class="quiz-action-btn secondary" onclick="history.back()">Fermer</button>
            ${s.mistakes.length > 0 ? `<button class="quiz-action-btn primary" onclick="retrainMistakes()">Refaire mes erreurs (${s.mistakes.length})</button>` : ''}
        </div>
    </div>`;
}

function retrainMistakes() {
    const s = trainingSession;
    if (!s || !s.mistakes.length) return;
    launchFreeTraining([...s.mistakes], s.mistakes.length, s.config);
}

function buildProgRow(label, done, total, icon) {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return `
        <div class="prog-card-item">
            <div class="prog-circle-badge" style="--pct:${pct}"><span>${pct}%</span></div>
            <div class="prog-card-info">
                <div class="prog-card-label">${icon ? icon + ' ' : ''}${label}</div>
                <div class="prog-card-stats">${done} / ${total}</div>
            </div>
        </div>
    `;
}

async function renderDashboard() {
    const container = document.getElementById('progression-list');
    if (!container) {
        console.warn("Conteneur 'progression-list' non trouvé dans le DOM.");
        return;
    }
    
    container.innerHTML = '<div style="color:var(--gray);font-size:0.75rem;padding:8px 0">Chargement des statistiques…</div>';

    const jlptLevels = [
        { jlpt: 5, id: 'n5', label: 'N5 - Débutant' },
        { jlpt: 4, id: 'n4', label: 'N4 - Élémentaire' },
        { jlpt: 3, id: 'n3', label: 'N3 - Intermédiaire' },
        { jlpt: 2, id: 'n2', label: 'N2 - Avancé' },
        { jlpt: 1, id: 'n1', label: 'N1 - Expert' }
    ];

    const rowsHtml = await Promise.all(jlptLevels.map(async levelDef => {
        // Kanji : lit maintenant la vraie liste triée par niveau (data/nX/kanji.json), pas un
        // filtrage par grade sur le gros kanji_jouyou_fr.json (qui donnait un tout autre chiffre)
        const chars = await getLevelKanjiChars(levelDef.id) || [];
        const totalKanji = chars.length;
        const totalMastery = chars.reduce((sum, c) => sum + getKanjiMastery(c), 0);
        const avgMastery = totalKanji > 0 ? Math.round(totalMastery / totalKanji) : 0;
        const practicedKanji = chars.filter(c => {
            return localStorage.getItem(`quiz_${c}`) || localStorage.getItem(`trace_${c}`);
        }).length;
        
        // Vocab + Grammaire (fetch caché)
        const vg = await getLevelVocabGrammarStats(levelDef.id);
        
        const kanjiSubRow = buildProgRow('Kanji', practicedKanji, totalKanji, '🔤');
        const vocabSubRow = vg.vocabTotal > 0 ? buildProgRow('Vocabulaire', vg.vocabMastered, vg.vocabTotal, '📚') : '';
        const grammarSubRow = vg.grammarTotal > 0 ? buildProgRow('Grammaire', vg.grammarMastered, vg.grammarTotal, '📝') : '';
        
        // % global : moyenne des composantes qui ont des données (kanji toujours dispo, vocab/grammaire si déployés)
        const parts = [avgMastery];
        if (vg.vocabTotal > 0) parts.push(Math.round((vg.vocabMastered / vg.vocabTotal) * 100));
        if (vg.grammarTotal > 0) parts.push(Math.round((vg.grammarMastered / vg.grammarTotal) * 100));
        const globalPct = Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
        
        const levelKey = `lvl-${levelDef.id}`;
        const levelColor = jlptMapping?.levels?.[levelDef.id]?.color || 'var(--accent)';
        return `
            <div class="prog-level-card" style="border-color:${levelColor}55; box-shadow:0 0 16px ${levelColor}22; background:${levelColor}1f;">
                <div class="prog-level-header" onclick="document.getElementById('${levelKey}').classList.toggle('open'); this.querySelector('.prog-level-arrow').classList.toggle('open')">
                    <span class="prog-level-arrow">▶</span>
                    <div class="prog-level-circle" style="--pct:${globalPct}; --ring-color:${levelColor}"><span>${globalPct}%</span></div>
                    <span class="prog-level-title">${levelDef.label}</span>
                </div>
                <div class="prog-level-items" id="${levelKey}">
                    ${kanjiSubRow}${vocabSubRow}${grammarSubRow}
                </div>
            </div>
        `;
    }));
    
    container.innerHTML = rowsHtml.join('');
}

// 2. La fonction d'initialisation principale
// Réinitialisation forcée : désenregistre le Service Worker + vide tous les caches,
// puis recharge. Utile pour les tests, quand le cache reste bloqué sur une vieille version.
async function forceFullReset() {
    try {
        if (navigator.serviceWorker) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
        }
        const names = await caches.keys();
        await Promise.all(names.map(n => caches.delete(n)));
    } catch (e) {
        console.warn('Erreur pendant la réinitialisation :', e);
    }
    location.href = location.pathname; // recharge sans le paramètre ?reset
}

// Déclenchement via URL (utile sur PC : ajouter ?reset=1 à la fin de l'adresse)
if (new URLSearchParams(location.search).has('reset')) {
    forceFullReset();
}

async function init() {
    const mainContent = document.getElementById('main-content');
    
    // Affichage du loader
    mainContent.innerHTML = `
        <div style="height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px">
            <div class="spinner"></div>
            <div style="font-size:0.8125rem;color:var(--gray)">Chargement de la base de données…</div>
        </div>`;

    try {
        // Chargement en parallèle : mapping JLPT + Kanjis
        const [mappingRes, kanjiRes] = await Promise.all([
            fetch('./data/mapping.json', { cache: 'no-store' }),
            fetch('https://raw.githubusercontent.com/shinobux9-max/Kanji-trad/refs/heads/main/kanji_jouyou_fr.json', { cache: 'no-store' })
        ]);
        
        if (!kanjiRes.ok) throw new Error(`Erreur réseau kanji : ${kanjiRes.status}`);
        
        // Charger mapping (fallback si fichier manquant)
        if (mappingRes.ok) {
            jlptMapping = await mappingRes.json();
            console.log('✅ Mapping JLPT chargé');
        } else {
            console.warn('⚠️ data/mapping.json non trouvé, fallback à structure par défaut');
            jlptMapping = null;
        }
        
        // Enregistre l'ouverture de l'app du jour (pour le streak) — idempotent si déjà fait aujourd'hui
        recordDailyActivity();
        
        // Précharge la grammaire en arrière-plan pour que le système de renvoi "voir" entre
        // leçons fonctionne dès la première navigation, sans attendre un fetch à la volée.
        preloadAllGrammarLevels();

        let text = await kanjiRes.text();
        text = text.trim();
        // Nettoyage sommaire au cas où le JSON GitHub soit mal formé
        if (!text.startsWith('{')) text = '{' + text;
        if (!text.endsWith('}'))  text = text.replace(/,\s*$/, '') + '}';
        const data = JSON.parse(text);

        // Transformation en tableau d'objets
        kanjiDb = [];
        kanjiMap.clear();
        Object.entries(data).forEach(([char, v], i) => {
            kanjiDb.push({
                char,
                grade:    v.classe ?? null,
                meanings: v.sens            || [],
                on:       v.lectures_on     || [],
                kun:      v.lectures_kun    || [],
                wk_on:    v.wk_lectures_on  || [],
                wk_kun:   v.wk_lectures_kun || [],
                strokes:  v.traits || 0,
                romaji:   v.romaji || '–'
            });
            kanjiMap.set(char, i);
        });

        // Chargement des exemples : localStorage en priorité, GitHub en fallback
        const CACHE_KEY = 'exemplesDb_v2';
        try {
            // 1. Essai depuis le cache localStorage (instantané, offline-proof)
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                exemplesDb = JSON.parse(cached);
                console.log(`✅ Exemples depuis cache (${Object.keys(exemplesDb).length} kanji)`);
            }

            // 2. Toujours rafraîchir depuis GitHub en arrière-plan
            fetch('https://raw.githubusercontent.com/shinobux9-max/Kanji-trad/refs/heads/main/exemples.json', { cache: 'no-store' })
                .then(r => r.ok ? r.json() : Promise.reject(r.status))
                .then(data => {
                    exemplesDb = data;
                    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch(_) {}
                    console.log(`✅ Exemples mis à jour depuis GitHub (${Object.keys(data).length} kanji)`);
                })
                .catch(e => console.warn('Refresh exemples GitHub échoué :', e));

        } catch(e) {
            console.warn('Exemples non disponibles :', e.message);
            exemplesDb = {};
        }

        // Construction des structures internes
        buildCategories();
        buildSeries();

        // Affichage du dashboard : d'abord le HTML (showDashboard),
        // puis les barres de progression (renderDashboard)
        document.getElementById('page-title').innerText = '漢字 Study';
        showDashboard();
        renderDashboard();
        setActiveBottomNav('accueil');

        console.log(`✅ ${kanjiDb.length} kanji chargés — ${seriesMap.size} séries créées`);

    } catch(e) {
        console.error('Erreur BDD:', e);
        mainContent.innerHTML = `
            <div style="padding:40px 20px;text-align:center;color:var(--gray)">
                <div style="font-size:2.5rem;margin-bottom:12px">⚠️</div>
                <div style="margin-bottom:16px">Impossible de charger la base de données.<br>${e.message}</div>
                <button onclick="init()" style="padding:10px 24px;background:var(--accent);border:none;color:#000;border-radius:8px;font-weight:bold;cursor:pointer;font-size:0.875rem">Réessayer</button>
            </div>`;
    }
}

/* ══════════════════════════════════════════════════
   PULL-TO-REFRESH — tirer vers le bas en haut de l'écran pour actualiser,
   comme dans un navigateur classique
══════════════════════════════════════════════════ */
(function initPullToRefresh() {
    const container = document.getElementById('main-content');
    if (!container) return;

    const PULL_THRESHOLD = 80;
    let startY = 0;
    let pulling = false;
    let indicator = null;

    function ensureIndicator() {
        if (indicator) return indicator;
        indicator = document.createElement('div');
        indicator.id = 'ptr-indicator';
        indicator.innerText = '↓';
        document.body.appendChild(indicator);
        return indicator;
    }

    container.addEventListener('touchstart', (e) => {
        pulling = container.scrollTop <= 0;
        if (pulling) startY = e.touches[0].clientY;
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
        if (!pulling) return;
        const deltaY = e.touches[0].clientY - startY;
        if (deltaY > 0 && container.scrollTop <= 0) {
            const ind = ensureIndicator();
            const pull = Math.min(deltaY, PULL_THRESHOLD * 1.5);
            ind.style.opacity = Math.min(pull / PULL_THRESHOLD, 1);
            ind.style.transform = `translateX(-50%) translateY(${pull}px) rotate(${pull * 3}deg)`;
            ind.classList.toggle('ready', pull >= PULL_THRESHOLD);
            ind.dataset.pull = pull;
        }
    }, { passive: true });

    container.addEventListener('touchend', () => {
        if (!pulling) return;
        pulling = false;
        if (indicator) {
            const pull = parseFloat(indicator.dataset.pull || 0);
            if (pull >= PULL_THRESHOLD) {
                indicator.classList.add('loading');
                indicator.innerText = '↻';
                setTimeout(() => location.reload(), 300);
            } else {
                indicator.style.opacity = 0;
                indicator.style.transform = 'translateX(-50%) translateY(0)';
            }
        }
    }, { passive: true });
})();

// Lancement au démarrage
init();

/* ── GESTION DU BOUTON RETOUR SYSTÈME (Android / Navigateur) ── */
// Registre des modaux/overlays/sessions : associe un nom à sa fonction de fermeture.
// Contrairement aux écrans "pleins" (SCREEN_REGISTRY), on ne rejoue pas leur état exact
// (une session de révision en cours ne se restaure pas carte par carte) — on se contente
// de les fermer proprement, exactement comme le ferait leur bouton "✕"/Fermer.
const MODAL_EXIT_REGISTRY = {
    'vocab-review': () => { reviewSession = null; showRevisionLevelPicker('vocab', true); },
    'vocab-review-selector': () => showRevisionLevelPicker('vocab', true),
    'grammar-review': () => { grammarReviewSession = null; showRevisionLevelPicker('grammar', true); },
    'grammar-review-selector': () => showRevisionLevelPicker('grammar', true),
    'grammar-lesson-flow': () => { lessonSession = null; showApprendreScreen(true); },
    'lesson-onboarding': () => showApprendreScreen(true),
    'kanji-review-selector': () => { if (kanjiHomeData) loadJLPTCategory(kanjiHomeData.levelId, 'kanji', true); },
    'kanji-review-flashcard': () => { kanjiReviewSession = null; if (kanjiHomeData) loadJLPTCategory(kanjiHomeData.levelId, 'kanji', true); },
    'apprendre-discovery': () => { mixedReviewSession = null; showApprendreScreen(true); },
    'mixed-review-dashboard': () => { mixedReviewSession = null; showDashboard(true); renderDashboard(); },
    'search': () => closeSearchOverlay(),
    'kana-mode-selector': () => showRevisionKanaPicker(true),
    'kana-review-flashcard': () => { kanaReviewSession = null; showRevisionKanaPicker(true); },
    'kana-trace-review': () => showRevisionKanaPicker(true),
    'free-training-session': () => {
        if (trainingChronoInterval) { clearInterval(trainingChronoInterval); trainingChronoInterval = null; }
        trainingSession = null;
        showFreeTrainingConfig(true);
    },
};

// À appeler à l'entrée de chaque modal/session : pousse UNE entrée d'historique.
// La sortie (bouton "✕"/Fermer OU bouton retour matériel) doit systématiquement passer
// par history.back(), jamais appeler la fonction de fermeture directement — sinon l'entrée
// pushée ici reste orpheline dans l'historique et le bouton retour suivant ne fait rien d'utile.
function pushModalState(name) {
    history.pushState({ view: 'modal', modal: name }, '');
}

// Registre des écrans "pleins" : associe le nom d'écran stocké dans history.state
// à la fonction qui sait le rejouer (avec isBack=true pour ne pas re-pousser un état)
const SCREEN_REGISTRY = {
    'dashboard': () => { showDashboard(true); renderDashboard(); },
    'free-training-config': () => showFreeTrainingConfig(true),
    'category': (s) => loadCategory(s.id, true),
    'series': (s) => loadSeriesPage(s.id, true),
    'niveaux': () => showNiveauxScreen(true),
    'apprendre': () => showApprendreScreen(true),
    'explore-lessons': () => showExploreLessonsScreen(true),
    'grammar-niveaux': () => showGrammarNiveauxScreen(true),
    'kanji-niveaux': () => showKanjiNiveauxScreen(true),
    'progression': () => showProgressionDetail(true),
    'category-direct': (s) => showCategoryDirect(s.levelId, s.category, true),
    'kanji-list': () => { if (kanjiHomeData) displayKanjiList(kanjiHomeData.levelId, { chars: kanjiHomeData.chars }, true); },
    'vocab-list': () => { if (vocabHomeData) displayVocabList(vocabHomeData.levelId, vocabHomeData.data, vocabHomeData.examples, true); },
    'vocab-detail': (s) => { if (vocabHomeData) showVocabDetail(s.wordId, vocabHomeData.data, true); },
    'grammar-home': () => { if (grammarHomeData) showGrammarHome(grammarHomeData.levelId, grammarHomeData.data, grammarHomeData.examples, true); },
    'grammar-detail': (s) => showGrammarDetail(s.lessonId, true),
    'revisions': () => showRevisionsScreen(true),
    'revision-level-picker': (s) => showRevisionLevelPicker(s.category, true),
    'revision-kana-picker': () => showRevisionKanaPicker(true),
};

// Sécurité partagée : ferme systématiquement tous les overlays plein écran (fiche, quiz, tracé)
// ET annule toute session de révision "légère" en cours (vocab/grammaire/kana/mixte/kanji/
// entraînement libre) quelle que soit la façon dont l'utilisateur quitte l'écran — bouton retour
// matériel (via onpopstate) OU bottom-nav (qui reste cliquable en permanence, même par-dessus une
// session active, puisqu'elle est en position fixe et ne passe jamais par l'historique).
// Sans ce filet commun, quitter une session via la bottom-nav laisse son état orphelin en mémoire —
// inoffensif la plupart du temps, mais potentiellement plantant pour l'Entraînement libre en mode
// Chrono (le minuteur continuerait de tourner et d'essayer d'écrire dans un conteneur disparu).
function closeAllOverlaysAndSessions() {
    closeDetail();
    closeStrokeQuiz();
    closeQuiz();
    if (searchOpen) closeSearchOverlay();

    // Le mode sélection en masse ne pousse pas d'état d'historique propre (pas un modal, juste
    // un mode d'affichage in-place) : sans ce nettoyage, il resterait actif sur l'écran suivant.
    if (bulkSelectMode) {
        bulkSelectMode     = false;
        bulkSelectRerender = null;
        updateBulkActionBar();
    }

    reviewSession = null;
    grammarReviewSession = null;
    kanaReviewSession = null;
    mixedReviewSession = null;
    kanjiReviewSession = null;
    if (trainingChronoInterval) { clearInterval(trainingChronoInterval); trainingChronoInterval = null; }
    trainingSession = null;
}

window.onpopstate = function(event) {
    // Si l'application n'est pas encore chargée (kanjiDb vide), on ne fait rien
    if (kanjiDb.length === 0) return;

    closeAllOverlaysAndSessions();

    if (event.state && event.state.view === 'modal' && MODAL_EXIT_REGISTRY[event.state.modal]) {
        MODAL_EXIT_REGISTRY[event.state.modal]();
    } else if (event.state && SCREEN_REGISTRY[event.state.view]) {
        SCREEN_REGISTRY[event.state.view](event.state);
    } else {
        // État inconnu ou tout début de l'historique : retour à l'accueil
        showDashboard(true);
        renderDashboard();
    }
};
